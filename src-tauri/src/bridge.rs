//! Bridge between Tauri async runtime and Rayforce thread
//!
//! Rayforce requires all operations (eval, drop_obj) to happen on its thread.
//! This module provides:
//! - A dedicated Rayforce thread with command processing
//! - Async command/response channels for Tauri commands
//! - Handle management for query results

use crate::rayforce_ffi::{self, ObjP, TYPE_ERR, TYPE_TABLE};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::CString;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::{self, JoinHandle};
use tokio::sync::{mpsc, oneshot};

// =============================================================================
// Types
// =============================================================================

/// Metadata about a query result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryMeta {
    pub handle: u64,
    pub columns: Vec<String>,
    pub column_types: HashMap<String, String>,
    pub row_count: u64,
    pub result_type: String,
}

/// A single row of data
pub type Row = HashMap<String, serde_json::Value>;

/// Commands sent to the Rayforce thread
pub enum RayCommand {
    /// Execute a query, store result, return metadata
    Execute {
        query_id: String,
        code: String,
        response: oneshot::Sender<Result<QueryMeta, String>>,
    },
    /// Get rows from a stored result
    GetRows {
        handle: u64,
        start: u64,
        count: u64,
        response: oneshot::Sender<Result<Vec<Row>, String>>,
    },
    /// Release a handle (drop_obj)
    Release { handle: u64 },
    /// Cancel a pending query
    Cancel { query_id: String },
    /// Shutdown the Rayforce thread
    Shutdown,
}

/// Response from Rayforce thread (for internal use)
#[derive(Debug)]
pub enum RayResponse {
    QueryResult(Result<QueryMeta, String>),
    Rows(Result<Vec<Row>, String>),
    Released,
    Cancelled,
}

// =============================================================================
// Bridge
// =============================================================================

/// Bridge to Rayforce thread
pub struct RayforceBridge {
    /// Channel to send commands to Rayforce thread
    command_tx: mpsc::UnboundedSender<RayCommand>,
    /// Receiver stored until thread starts
    command_rx: Mutex<Option<mpsc::UnboundedReceiver<RayCommand>>>,
    /// Handle to the Rayforce thread
    thread_handle: Mutex<Option<JoinHandle<()>>>,
    /// Whether the bridge is running
    running: AtomicBool,
    /// Cancelled query IDs (checked before storing results)
    cancelled: Mutex<std::collections::HashSet<String>>,
}

impl RayforceBridge {
    /// Create a new bridge (does not start the thread yet)
    pub fn new() -> Result<Self, String> {
        let (command_tx, command_rx) = mpsc::unbounded_channel();

        let bridge = Self {
            command_tx,
            command_rx: Mutex::new(Some(command_rx)),
            thread_handle: Mutex::new(None),
            running: AtomicBool::new(false),
            cancelled: Mutex::new(std::collections::HashSet::new()),
        };

        Ok(bridge)
    }

    /// Start the Rayforce thread
    pub fn start(&self) {
        if self.running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        // Take the receiver from storage
        let rx = self.command_rx.lock().take()
            .expect("start() called but receiver already taken");

        let handle = thread::spawn(move || {
            rayforce_thread_main(rx);
        });

        *self.thread_handle.lock() = Some(handle);
    }

    /// Execute a query
    pub async fn execute_query(
        &self,
        query_id: String,
        code: String,
    ) -> Result<QueryMeta, String> {
        let (response_tx, response_rx) = oneshot::channel();

        self.command_tx
            .send(RayCommand::Execute {
                query_id,
                code,
                response: response_tx,
            })
            .map_err(|_| "Failed to send command to Rayforce thread")?;

        response_rx
            .await
            .map_err(|_| "Rayforce thread dropped response channel")?
    }

    /// Get rows from a stored result
    pub async fn get_rows(
        &self,
        handle: u64,
        start: u64,
        count: u64,
    ) -> Result<Vec<Row>, String> {
        let (response_tx, response_rx) = oneshot::channel();

        self.command_tx
            .send(RayCommand::GetRows {
                handle,
                start,
                count,
                response: response_tx,
            })
            .map_err(|_| "Failed to send command to Rayforce thread")?;

        response_rx
            .await
            .map_err(|_| "Rayforce thread dropped response channel")?
    }

    /// Release a handle
    pub async fn release_handle(&self, handle: u64) -> Result<(), String> {
        self.command_tx
            .send(RayCommand::Release { handle })
            .map_err(|_| "Failed to send command to Rayforce thread")?;
        Ok(())
    }

    /// Cancel a pending query
    pub async fn cancel_query(&self, query_id: String) -> Result<(), String> {
        self.cancelled.lock().insert(query_id.clone());
        self.command_tx
            .send(RayCommand::Cancel { query_id })
            .map_err(|_| "Failed to send command to Rayforce thread")?;
        Ok(())
    }

    /// Shutdown the bridge
    pub fn shutdown(&self) {
        let _ = self.command_tx.send(RayCommand::Shutdown);
        self.running.store(false, Ordering::SeqCst);

        if let Some(handle) = self.thread_handle.lock().take() {
            let _ = handle.join();
        }
    }
}

impl Drop for RayforceBridge {
    fn drop(&mut self) {
        self.shutdown();
    }
}

// =============================================================================
// Rayforce Thread
// =============================================================================

/// Main function for the Rayforce thread
fn rayforce_thread_main(mut command_rx: mpsc::UnboundedReceiver<RayCommand>) {
    log::info!("Rayforce thread starting");

    // Initialize Rayforce runtime
    let init_result = unsafe { rayforce_ffi::ray_init() };
    if init_result != 0 {
        log::error!("Failed to initialize Rayforce runtime: {}", init_result);
        return;
    }
    log::info!("Rayforce runtime initialized");

    // Self-test: verify vector data reading works
    {
        let test_code = std::ffi::CString::new("(til 10)").unwrap();
        let result = unsafe { rayforce_ffi::eval_str(test_code.as_ptr()) };
        if !result.is_null() {
            let obj = unsafe { &*result };
            if obj.type_ == 5 {
                let len = unsafe { obj.len() };
                let data_ptr = unsafe { obj.data_ptr::<i64>() };
                let values: Vec<i64> = (0..len as usize).map(|i| unsafe { *data_ptr.add(i) }).collect();
                eprintln!("[SELF-TEST] (til 10) = {:?}", values);
            }
            unsafe { rayforce_ffi::drop_obj(result) };
        }
    }

    // Handle storage: handle_id -> obj_p
    let mut handles: HashMap<u64, ObjP> = HashMap::new();
    let mut next_handle: u64 = 1;

    // Cancelled query IDs
    let mut cancelled: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Command loop (blocking receive in sync context)
    while let Some(cmd) = command_rx.blocking_recv() {
        match cmd {
            RayCommand::Execute {
                query_id,
                code,
                response,
            } => {
                // Check if cancelled
                if cancelled.remove(&query_id) {
                    let _ = response.send(Err("Query cancelled".to_string()));
                    continue;
                }

                let result = execute_query_impl(&code, &mut handles, &mut next_handle);
                let _ = response.send(result);
            }

            RayCommand::GetRows {
                handle,
                start,
                count,
                response,
            } => {
                let result = get_rows_impl(handle, start, count, &handles);
                let _ = response.send(result);
            }

            RayCommand::Release { handle } => {
                if let Some(obj) = handles.remove(&handle) {
                    unsafe { rayforce_ffi::drop_obj(obj) };
                    log::debug!("Released handle {}", handle);
                }
            }

            RayCommand::Cancel { query_id } => {
                cancelled.insert(query_id);
            }

            RayCommand::Shutdown => {
                log::info!("Rayforce thread shutting down");
                break;
            }
        }
    }

    // Clean up all remaining handles
    for (handle, obj) in handles.drain() {
        log::debug!("Cleaning up handle {} on shutdown", handle);
        unsafe { rayforce_ffi::drop_obj(obj) };
    }

    // Clean up Rayforce runtime
    unsafe { rayforce_ffi::ray_clean() };
    log::info!("Rayforce thread stopped");
}

/// Execute a query and store the result
fn execute_query_impl(
    code: &str,
    handles: &mut HashMap<u64, ObjP>,
    next_handle: &mut u64,
) -> Result<QueryMeta, String> {
    log::debug!("Executing query: {}", code);

    let c_code = CString::new(code).map_err(|e| format!("Invalid query string: {}", e))?;
    let result = unsafe { rayforce_ffi::eval_str(c_code.as_ptr()) };

    if result.is_null() {
        return Err("Query returned null".to_string());
    }

    // Check for error
    let obj = unsafe { &*result };

    if obj.is_error() {
        let err_msg = extract_error_message(result);
        unsafe { rayforce_ffi::drop_obj(result) };
        return Err(err_msg);
    }

    // Generate handle and store result
    let handle = *next_handle;
    *next_handle += 1;
    handles.insert(handle, result);

    // Extract metadata
    let meta = extract_query_meta(handle, result)?;

    log::debug!(
        "Query complete: handle={}, type={}, rows={}",
        handle,
        meta.result_type,
        meta.row_count
    );

    Ok(meta)
}

/// Extract metadata from a query result
fn extract_query_meta(handle: u64, obj: ObjP) -> Result<QueryMeta, String> {
    let obj_ref = unsafe { &*obj };
    let type_code = obj_ref.type_;

    let result_type = match type_code {
        TYPE_TABLE => "table",
        TYPE_ERR => "error",
        99 => "dict",
        0 => "list",
        t if t < 0 => "scalar",
        t if t >= 1 && t <= 12 => "vector",
        _ => "unknown",
    }
    .to_string();

    let (columns, column_types, row_count) = match type_code {
        TYPE_TABLE => extract_table_meta(obj)?,
        99 => extract_dict_meta(obj)?,
        t if t < 0 => {
            // Scalar - 1 row with "value" column
            (vec!["value".to_string()], HashMap::new(), 1)
        }
        t if t >= 0 && t <= 12 => {
            // Vector/list - length rows with "value" column
            let len = unsafe { obj_ref.len() as u64 };
            (vec!["value".to_string()], HashMap::new(), len)
        }
        _ => (vec![], HashMap::new(), 0),
    };

    Ok(QueryMeta {
        handle,
        columns,
        column_types,
        row_count,
        result_type,
    })
}

/// Extract table metadata (columns, types, row count)
fn extract_table_meta(obj: ObjP) -> Result<(Vec<String>, HashMap<String, String>, u64), String> {
    // Get keys (column names) from table
    let keys = unsafe { rayforce_ffi::ray_key(obj) };
    if keys.is_null() {
        return Ok((vec![], HashMap::new(), 0));
    }

    let keys_ref = unsafe { &*keys };
    let num_cols = unsafe { keys_ref.len() as usize };

    let mut columns = Vec::with_capacity(num_cols);
    let mut column_types = HashMap::new();

    // Extract column names from symbol vector
    for i in 0..num_cols {
        let col_sym = unsafe { rayforce_ffi::at_idx(keys, i as i64) };
        if !col_sym.is_null() {
            let col_name = symbol_to_string(col_sym);
            columns.push(col_name);
        }
    }

    // Get values to determine row count
    let values = unsafe { rayforce_ffi::ray_value(obj) };
    let row_count = if !values.is_null() {
        // Values is a list of column vectors, get length of first column
        let first_col = unsafe { rayforce_ffi::at_idx(values, 0) };
        if !first_col.is_null() {
            let first_ref = unsafe { &*first_col };
            if first_ref.is_vector() || first_ref.is_list() {
                unsafe { first_ref.len() as u64 }
            } else {
                0
            }
        } else {
            0
        }
    } else {
        0
    };

    Ok((columns, column_types, row_count))
}

/// Extract dict metadata
fn extract_dict_meta(obj: ObjP) -> Result<(Vec<String>, HashMap<String, String>, u64), String> {
    let keys = unsafe { rayforce_ffi::ray_key(obj) };
    if keys.is_null() {
        return Ok((vec![], HashMap::new(), 0));
    }

    let keys_ref = unsafe { &*keys };
    let num_keys = unsafe { keys_ref.len() as usize };

    let mut columns = Vec::with_capacity(num_keys);
    for i in 0..num_keys {
        let ray_key = unsafe { rayforce_ffi::at_idx(keys, i as i64) };
        if !ray_key.is_null() {
            columns.push(symbol_to_string(ray_key));
        }
    }

    // Dict has 1 "row"
    Ok((columns, HashMap::new(), 1))
}

/// Convert symbol object to string
fn symbol_to_string(obj: ObjP) -> String {
    if obj.is_null() {
        return String::new();
    }
    let obj_ref = unsafe { &*obj };

    // For symbol atoms (type -6), the data is a pointer to the interned string
    if obj_ref.type_ == -6 {
        // Symbol data is stored differently - use eval to convert
        // For now, use a simple index-based name
        format!("col_{}", unsafe { obj_ref.as_i64() })
    } else if obj_ref.type_ == 12 || obj_ref.type_ == -12 {
        // C8 vector or char - it's a string
        let len = if obj_ref.type_ > 0 {
            unsafe { obj_ref.len() as usize }
        } else {
            1
        };
        if len == 0 {
            return String::new();
        }
        // Read the string data
        let data_ptr = unsafe { obj_ref.data_ptr::<u8>() };
        if data_ptr.is_null() {
            return String::new();
        }
        let bytes = unsafe { std::slice::from_raw_parts(data_ptr, len) };
        String::from_utf8_lossy(bytes).to_string()
    } else {
        format!("col_{}", obj_ref.type_)
    }
}

/// Extract error message from an error object
fn extract_error_message(obj: ObjP) -> String {
    if obj.is_null() {
        return "Unknown error".to_string();
    }

    // Try to get the 'msg' or 'message' key from the error dict
    let msg_key = CString::new("msg").unwrap();
    let msg = unsafe { rayforce_ffi::at_sym(obj, msg_key.as_ptr(), 3) };

    if !msg.is_null() {
        let msg_ref = unsafe { &*msg };
        if msg_ref.type_ == 12 {
            // C8 vector (string)
            return symbol_to_string(msg);
        }
    }

    "Query execution error".to_string()
}

/// Get rows from a stored result
fn get_rows_impl(
    handle: u64,
    start: u64,
    count: u64,
    handles: &HashMap<u64, ObjP>,
) -> Result<Vec<Row>, String> {
    let obj = handles
        .get(&handle)
        .ok_or_else(|| format!("Invalid handle: {}", handle))?;

    let obj_ref = unsafe { &**obj };
    let type_code = obj_ref.type_;

    // Handle different types
    match type_code {
        t if t < 0 => {
            // Scalar - return single row with value
            if start > 0 {
                return Ok(vec![]);
            }
            let mut row = HashMap::new();
            row.insert("value".to_string(), obj_to_json(*obj)?);
            Ok(vec![row])
        }
        t if t >= 0 && t <= 12 => {
            // Vector - return elements as rows
            // Read directly from inline data buffer for primitive vectors
            let total = unsafe { obj_ref.len() as u64 };
            let actual_count = std::cmp::min(count, total.saturating_sub(start));
            let mut rows = Vec::with_capacity(actual_count as usize);

            match t {
                5 => {
                    // I64 vector - read directly from inline data
                    let data_ptr = unsafe { obj_ref.data_ptr::<i64>() };
                    for i in 0..actual_count {
                        let idx = (start + i) as usize;
                        let val = unsafe { *data_ptr.add(idx) };
                        let mut row = HashMap::new();
                        row.insert("value".to_string(), serde_json::json!(val));
                        rows.push(row);
                    }
                }
                10 => {
                    // F64 vector - read directly from inline data
                    let data_ptr = unsafe { obj_ref.data_ptr::<f64>() };
                    for i in 0..actual_count {
                        let idx = (start + i) as usize;
                        let val = unsafe { *data_ptr.add(idx) };
                        let mut row = HashMap::new();
                        row.insert("value".to_string(), serde_json::json!(val));
                        rows.push(row);
                    }
                }
                _ => {
                    // Other vector types - use at_idx
                    for i in 0..actual_count {
                        let idx = start + i;
                        let elem = unsafe { rayforce_ffi::at_idx(*obj, idx as i64) };
                        let mut row = HashMap::new();
                        row.insert("value".to_string(), obj_to_json(elem)?);
                        rows.push(row);
                    }
                }
            }
            Ok(rows)
        }
        TYPE_TABLE => {
            // Table - get rows by index
            get_table_rows(*obj, start, count)
        }
        99 => {
            // Dict - return as single row
            if start > 0 {
                return Ok(vec![]);
            }
            let row = dict_to_row(*obj)?;
            Ok(vec![row])
        }
        _ => Err(format!("Unsupported type: {}", type_code)),
    }
}

/// Get rows from a table
fn get_table_rows(obj: ObjP, start: u64, count: u64) -> Result<Vec<Row>, String> {
    let keys = unsafe { rayforce_ffi::ray_key(obj) };
    let values = unsafe { rayforce_ffi::ray_value(obj) };

    if keys.is_null() || values.is_null() {
        return Ok(vec![]);
    }

    let keys_ref = unsafe { &*keys };
    let num_cols = unsafe { keys_ref.len() as usize };

    // Get column names
    let mut col_names = Vec::with_capacity(num_cols);
    for i in 0..num_cols {
        let col_sym = unsafe { rayforce_ffi::at_idx(keys, i as i64) };
        col_names.push(symbol_to_string(col_sym));
    }

    // Get row count from first column
    let first_col = unsafe { rayforce_ffi::at_idx(values, 0) };
    if first_col.is_null() {
        return Ok(vec![]);
    }
    let first_ref = unsafe { &*first_col };
    let total_rows = unsafe { first_ref.len() as u64 };
    let actual_count = std::cmp::min(count, total_rows.saturating_sub(start));

    let mut rows = Vec::with_capacity(actual_count as usize);

    for row_idx in 0..actual_count {
        let idx = start + row_idx;
        let mut row = HashMap::new();

        for col_idx in 0..num_cols {
            let col_vec = unsafe { rayforce_ffi::at_idx(values, col_idx as i64) };
            if !col_vec.is_null() {
                let elem = unsafe { rayforce_ffi::at_idx(col_vec, idx as i64) };
                let value = obj_to_json(elem)?;
                row.insert(col_names[col_idx].clone(), value);
            }
        }

        rows.push(row);
    }

    Ok(rows)
}

/// Convert dict to a row
fn dict_to_row(obj: ObjP) -> Result<Row, String> {
    let keys = unsafe { rayforce_ffi::ray_key(obj) };
    let values = unsafe { rayforce_ffi::ray_value(obj) };

    if keys.is_null() || values.is_null() {
        return Ok(HashMap::new());
    }

    let keys_ref = unsafe { &*keys };
    let num_keys = unsafe { keys_ref.len() as usize };

    let mut row = HashMap::new();

    for i in 0..num_keys {
        let ray_key = unsafe { rayforce_ffi::at_idx(keys, i as i64) };
        let val_obj = unsafe { rayforce_ffi::at_idx(values, i as i64) };

        let key_name = symbol_to_string(ray_key);
        let value = obj_to_json(val_obj)?;
        row.insert(key_name, value);
    }

    Ok(row)
}

/// Convert any Rayforce object to JSON value
fn obj_to_json(obj: ObjP) -> Result<serde_json::Value, String> {
    if obj.is_null() {
        return Ok(serde_json::Value::Null);
    }

    let obj_ref = unsafe { &*obj };
    let type_code = obj_ref.type_;

    match type_code {
        // Scalars (negative types)
        -1 => {
            // Boolean
            let val = unsafe { obj_ref.as_i64() };
            Ok(serde_json::Value::Bool(val != 0))
        }
        -2 | -3 | -4 | -5 => {
            // Integer types
            let val = unsafe { obj_ref.as_i64() };
            Ok(serde_json::json!(val))
        }
        -6 => {
            // Symbol - return as string
            Ok(serde_json::Value::String(symbol_to_string(obj)))
        }
        -7 => {
            // Date - return as integer (days since epoch)
            let val = unsafe { obj_ref.as_i64() };
            Ok(serde_json::json!(val))
        }
        -8 | -9 => {
            // Time/Timestamp - return as integer (nanoseconds)
            let val = unsafe { obj_ref.as_i64() };
            Ok(serde_json::json!(val))
        }
        -10 => {
            // Float
            let val = unsafe { obj_ref.as_f64() };
            Ok(serde_json::json!(val))
        }
        -12 => {
            // Char
            let val = unsafe { obj_ref.as_i64() as u8 as char };
            Ok(serde_json::Value::String(val.to_string()))
        }

        // Vectors (positive types 1-12)
        t if t >= 1 && t <= 12 => {
            let len = unsafe { obj_ref.len() as usize };
            let mut arr = Vec::with_capacity(len);
            for i in 0..len {
                let elem = unsafe { rayforce_ffi::at_idx(obj, i as i64) };
                arr.push(obj_to_json(elem)?);
            }
            Ok(serde_json::Value::Array(arr))
        }

        // List (type 0)
        0 => {
            let len = unsafe { obj_ref.len() as usize };
            let mut arr = Vec::with_capacity(len);
            for i in 0..len {
                let elem = unsafe { rayforce_ffi::at_idx(obj, i as i64) };
                arr.push(obj_to_json(elem)?);
            }
            Ok(serde_json::Value::Array(arr))
        }

        // Table
        TYPE_TABLE => {
            Ok(serde_json::json!({"type": "table", "rows": unsafe { obj_ref.len() }}))
        }

        // Dict
        99 => {
            let row = dict_to_row(obj)?;
            Ok(serde_json::json!(row))
        }

        // Error
        TYPE_ERR => {
            let msg = extract_error_message(obj);
            Ok(serde_json::json!({"error": msg}))
        }

        // Null
        126 => Ok(serde_json::Value::Null),

        _ => Ok(serde_json::json!({"type": type_code})),
    }
}
