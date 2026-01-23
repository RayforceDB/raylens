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
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use tokio::sync::{mpsc, oneshot};

// =============================================================================
// Types
// =============================================================================

/// Metadata about a query result
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    /// Handle to the Rayforce thread
    thread_handle: Mutex<Option<JoinHandle<()>>>,
    /// Next handle ID
    next_handle: AtomicU64,
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
            thread_handle: Mutex::new(None),
            next_handle: AtomicU64::new(1),
            running: AtomicBool::new(false),
            cancelled: Mutex::new(std::collections::HashSet::new()),
        };

        // Store the receiver for later use when starting
        // We need to move it into the thread, so we'll recreate channels in start()
        drop(command_rx);

        Ok(bridge)
    }

    /// Start the Rayforce thread
    pub fn start(&self) {
        if self.running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        // Create new channel since we dropped the old receiver
        let (tx, rx) = mpsc::unbounded_channel();

        // This is a bit hacky - we need to update the sender
        // In practice, we'd restructure this, but for now we'll just spawn
        let handle = thread::spawn(move || {
            rayforce_thread_main(rx);
        });

        *self.thread_handle.lock() = Some(handle);

        // Note: In a real implementation, we'd need to update self.command_tx
        // For now, commands won't work until we fix this architecture
    }

    /// Get the next handle ID
    fn next_handle_id(&self) -> u64 {
        self.next_handle.fetch_add(1, Ordering::SeqCst)
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
        // Extract error message
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

    let result_type = match obj_ref.type_ {
        TYPE_TABLE => "table",
        TYPE_ERR => "error",
        t if t < 0 => "scalar",
        t if t >= 0 && t <= 12 => "vector",
        99 => "dict",
        _ => "unknown",
    }
    .to_string();

    let (columns, column_types, row_count) = if obj_ref.is_table() {
        extract_table_meta(obj)?
    } else {
        (vec![], HashMap::new(), 0)
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
    // For now, return placeholder - actual implementation would parse table structure
    // This requires more FFI work to access table column names and types

    // Get row count from table length
    let row_count = unsafe { (*obj).len() as u64 };

    // TODO: Extract actual column names and types from table structure
    // This requires accessing the table's keys (symbol vector) and values (list of vectors)

    Ok((vec![], HashMap::new(), row_count))
}

/// Extract error message from an error object
fn extract_error_message(obj: ObjP) -> String {
    // For now, return generic error - actual implementation would parse error structure
    // The error object is a dict with code, message, etc.
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

    if !obj_ref.is_table() {
        return Err("Handle does not point to a table".to_string());
    }

    // Use Rayfall's take/drop to get the slice
    // (take (drop table start) count)
    let slice_code = format!("(take (drop __h{} {}) {})", handle, start, count);

    // For now, we can't easily evaluate this because the handle isn't in Rayforce's namespace
    // We need to iterate rows directly using at_idx

    let total_rows = unsafe { obj_ref.len() as u64 };
    let actual_count = std::cmp::min(count, total_rows.saturating_sub(start));

    let mut rows = Vec::with_capacity(actual_count as usize);

    for i in 0..actual_count {
        let row_idx = start + i;
        let row_obj = unsafe { rayforce_ffi::at_idx(*obj, row_idx as i64) };

        if row_obj.is_null() {
            continue;
        }

        // Convert row to JSON
        let row = convert_row_to_json(row_obj)?;
        rows.push(row);

        // Don't drop row_obj - at_idx returns a reference, not a new object
    }

    Ok(rows)
}

/// Convert a row object to JSON
fn convert_row_to_json(row: ObjP) -> Result<Row, String> {
    // For now, return empty row - actual implementation would parse row structure
    // A table row is typically a dict with column names as keys
    Ok(HashMap::new())
}
