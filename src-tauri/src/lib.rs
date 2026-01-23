mod bridge;
pub mod commands;
mod rayforce_ffi;

use once_cell::sync::OnceCell;
use std::sync::Arc;

pub use bridge::RayforceBridge;
pub use rayforce_ffi::*;

/// Global bridge instance
static BRIDGE: OnceCell<Arc<RayforceBridge>> = OnceCell::new();

/// Initialize the global bridge
pub fn init_bridge() -> Result<(), String> {
    let bridge = Arc::new(RayforceBridge::new()?);
    BRIDGE.set(bridge).map_err(|_| "Bridge already initialized".to_string())?;
    get_bridge().start();
    Ok(())
}

/// Get the global bridge instance
pub fn get_bridge() -> &'static Arc<RayforceBridge> {
    BRIDGE.get().expect("Bridge not initialized - call init_bridge() first")
}
