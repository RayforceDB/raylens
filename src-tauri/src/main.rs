// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;
mod commands;
mod rayforce_ffi;

use bridge::RayforceBridge;
use once_cell::sync::OnceCell;
use std::sync::Arc;

/// Global bridge instance
static BRIDGE: OnceCell<Arc<RayforceBridge>> = OnceCell::new();

/// Get the global bridge instance
pub fn get_bridge() -> &'static Arc<RayforceBridge> {
    BRIDGE.get().expect("Bridge not initialized")
}

fn main() {
    // Initialize the Rayforce bridge
    let bridge = Arc::new(RayforceBridge::new().expect("Failed to initialize Rayforce bridge"));
    BRIDGE.set(bridge).expect("Bridge already initialized");

    // Start the Rayforce thread
    get_bridge().start();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::execute_query,
            commands::execute_scalar,
            commands::get_rows,
            commands::release_handle,
            commands::cancel_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
