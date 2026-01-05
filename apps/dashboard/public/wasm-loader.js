// Initialize Rayforce SDK after UMD bundle (rayforce.umd.js) is loaded
// This file is loaded as a module to ensure proper async/await support

(async () => {
  try {
    // Wait for DOM to be ready and UMD bundle to be loaded
    if (!window.Rayforce) {
      console.error('[wasm-loader] Rayforce UMD bundle not loaded');
      window.__rayforceError = new Error('Rayforce UMD bundle not loaded');
      return;
    }
    
    console.log('[wasm-loader] Initializing Rayforce SDK...');
    const sdk = await window.Rayforce.init();
    window.__rayforceSDK = sdk;
    console.log('[wasm-loader] SDK initialized, version:', sdk.version);
  } catch (err) {
    console.error('[wasm-loader] SDK init failed:', err);
    window.__rayforceError = err;
  }
})();
