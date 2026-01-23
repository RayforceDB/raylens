// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .init();

    log::info!("RayLens starting...");

    // Initialize the Rayforce bridge
    raylens_lib::init_bridge().expect("Failed to initialize Rayforce bridge");
    log::info!("Rayforce bridge initialized");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            raylens_lib::commands::execute_query,
            raylens_lib::commands::execute_scalar,
            raylens_lib::commands::get_rows,
            raylens_lib::commands::release_handle,
            raylens_lib::commands::cancel_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
