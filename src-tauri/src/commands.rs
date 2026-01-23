//! Tauri command handlers
//!
//! These async commands are invoked from the frontend via @tauri-apps/api.
//! They delegate to the RayforceBridge which handles thread-safe communication
//! with the Rayforce runtime.

use crate::bridge::{QueryMeta, Row};
use crate::get_bridge;
use serde::{Deserialize, Serialize};

/// Execute a Rayfall query
///
/// Returns metadata about the result including a handle for fetching rows.
/// The actual data stays in the Rayforce thread - use get_rows to fetch chunks.
#[tauri::command]
pub async fn execute_query(query_id: String, code: String) -> Result<QueryMeta, String> {
    log::debug!("execute_query: query_id={}, code={}", query_id, code);
    get_bridge().execute_query(query_id, code).await
}

/// Get rows from a query result
///
/// Fetches a chunk of rows from a previously executed query.
/// Use this for virtual scrolling / pagination.
#[tauri::command]
pub async fn get_rows(handle: u64, start: u64, count: u64) -> Result<Vec<Row>, String> {
    log::debug!(
        "get_rows: handle={}, start={}, count={}",
        handle,
        start,
        count
    );
    get_bridge().get_rows(handle, start, count).await
}

/// Release a query result handle
///
/// Frees the memory associated with a query result.
/// Call this when a widget unmounts or a query is re-run.
#[tauri::command]
pub async fn release_handle(handle: u64) -> Result<(), String> {
    log::debug!("release_handle: handle={}", handle);
    get_bridge().release_handle(handle).await
}

/// Cancel a pending query
///
/// Marks a query as cancelled. If the query is still running,
/// its result will be discarded when it completes.
#[tauri::command]
pub async fn cancel_query(query_id: String) -> Result<(), String> {
    log::debug!("cancel_query: query_id={}", query_id);
    get_bridge().cancel_query(query_id).await
}

/// Result wrapper for scalar values
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScalarResult {
    pub value: serde_json::Value,
    pub type_name: String,
}

/// Quick query for scalar results (doesn't create a handle)
/// Useful for single-value queries that don't need pagination
#[tauri::command]
pub async fn execute_scalar(code: String) -> Result<ScalarResult, String> {
    // Execute query
    let meta = get_bridge()
        .execute_query("__scalar__".to_string(), code)
        .await?;

    // For scalars, get the single value and release immediately
    if meta.result_type == "scalar" || meta.result_type == "vector" {
        let rows = get_bridge().get_rows(meta.handle, 0, 1).await?;
        get_bridge().release_handle(meta.handle).await?;

        if let Some(row) = rows.into_iter().next() {
            if let Some((_, value)) = row.into_iter().next() {
                return Ok(ScalarResult {
                    value,
                    type_name: meta.result_type,
                });
            }
        }

        return Ok(ScalarResult {
            value: serde_json::Value::Null,
            type_name: meta.result_type,
        });
    }

    // For tables, return row count as the scalar value
    get_bridge().release_handle(meta.handle).await?;
    Ok(ScalarResult {
        value: serde_json::json!({ "rowCount": meta.row_count }),
        type_name: "table".to_string(),
    })
}
