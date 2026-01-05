// Load Rayforce WASM module and initialize SDK
// This file is in /public and loaded as a module to bypass Vite's import analysis

import createRayforce from './rayforce.js';

window.createRayforce = createRayforce;
console.log('[wasm-loader] createRayforce loaded');

// Initialize SDK
try {
  const sdk = await window.Rayforce.init();
  window.__rayforceSDK = sdk;
  console.log('[wasm-loader] SDK initialized, version:', sdk.version);
} catch (err) {
  console.error('[wasm-loader] SDK init failed:', err);
  window.__rayforceError = err;
}
