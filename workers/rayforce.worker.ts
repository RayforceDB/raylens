/**
 * Rayforce WASM Worker
 *
 * Runs RayforceDB in a Web Worker for non-blocking computation.
 * This worker runs as an ES module.
 */

import type { WorkerRequest, WorkerResponse } from '../src/core/model/types';

interface RayforceModule {
  ccall: (name: string, returnType: string | null, argTypes: string[], args: unknown[]) => unknown;
  cwrap: (name: string, returnType: string | null, argTypes: string[]) => (...args: unknown[]) => unknown;
  UTF8ToString: (ptr: number, maxLength?: number) => string;
  stringToUTF8: (str: string, outPtr: number, maxBytesToWrite: number) => void;
  lengthBytesUTF8: (str: string) => number;
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _version_str: () => number;
  _eval_str: (ptr: number) => number;
  _strof_obj: (ptr: number) => number;
  _get_obj_type: (ptr: number) => number;
  _get_obj_len: (ptr: number) => number;
  _is_obj_error: (ptr: number) => number;
  _drop_obj: (ptr: number) => void;
}

// Module state
let rf: RayforceModule | null = null;
let version = '';
let initialized = false;

// Helper to allocate and write a string to WASM memory
function allocString(rf: RayforceModule, str: string): number {
  const len = rf.lengthBytesUTF8(str) + 1;
  const ptr = rf._malloc(len);
  rf.stringToUTF8(str, ptr, len);
  return ptr;
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'init':
        await handleInit();
        break;

      case 'eval':
        handleEval(message.id, message.expression);
        break;

      case 'load_data':
        await handleLoadData(message.id, message.data, message.format);
        break;

      case 'cancel':
        handleCancel(message.id);
        break;

      default:
        console.warn('[Worker] Unknown message type:', message);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const id = 'id' in message ? (message as { id: string }).id : 'unknown';
    respond({ type: 'error', id, message: msg });
  }
};

async function handleInit(): Promise<void> {
  if (initialized && rf) {
    respond({ type: 'ready', version });
    return;
  }

  try {
    console.log('[Worker] Initializing Rayforce WASM...');

    // Dynamically import the Rayforce WASM module
    // In a module worker, we can use dynamic import
    const wasmUrl = new URL('/rayforce/rayforce.js', self.location.origin).href;
    
    // Fetch and evaluate the module wrapper
    const response = await fetch(wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch rayforce.js: ${response.status}`);
    }
    
    let code = await response.text();
    
    // The rayforce.js is an ES module that exports createRayforce
    // We need to extract the factory and run it
    // Remove the export statement and capture the factory
    code = code.replace(/export\s+default\s+createRayforce\s*;?\s*$/, '');
    
    // Create a function that will return createRayforce
    // eslint-disable-next-line no-new-func
    const factory = new Function(`
      ${code}
      return createRayforce;
    `)();

    console.log('[Worker] WASM factory loaded, creating module...');

    // Create the WASM module with custom locateFile to find the .wasm
    rf = await factory({
      locateFile: (path: string) => {
        if (path.endsWith('.wasm')) {
          return new URL('/rayforce/rayforce.wasm', self.location.origin).href;
        }
        return path;
      },
    }) as RayforceModule;

    // Get version
    const versionPtr = rf._version_str();
    version = rf.UTF8ToString(versionPtr);

    initialized = true;
    console.log('[Worker] Rayforce ready:', version);
    respond({ type: 'ready', version });
  } catch (error) {
    console.error('[Worker] Init error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to initialize WASM';
    respond({ type: 'error', id: 'init', message: msg });
  }
}

function handleEval(id: string, expression: string): void {
  if (!rf) {
    respond({ type: 'error', id, message: 'SDK not initialized' });
    return;
  }

  try {
    // Allocate the expression string
    const exprPtr = allocString(rf, expression);
    
    // Evaluate the expression
    const resultPtr = rf._eval_str(exprPtr);
    rf._free(exprPtr);

    // Check if result is an error
    if (rf._is_obj_error(resultPtr)) {
      const errStrPtr = rf._strof_obj(resultPtr);
      const errMsg = rf.UTF8ToString(errStrPtr);
      rf._drop_obj(resultPtr);
      respond({ type: 'error', id, message: errMsg });
      return;
    }

    // Convert result to string representation
    const strPtr = rf._strof_obj(resultPtr);
    const resultStr = rf.UTF8ToString(strPtr);
    rf._drop_obj(resultPtr);

    respond({ type: 'result', id, data: resultStr });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Evaluation error';
    respond({ type: 'error', id, message: msg });
  }
}

async function handleLoadData(
  id: string,
  data: ArrayBuffer,
  format: 'rayforce' | 'csv'
): Promise<void> {
  if (!rf) {
    respond({ type: 'error', id, message: 'SDK not initialized' });
    return;
  }

  try {
    if (format === 'csv') {
      // Parse CSV (basic implementation for testing)
      const text = new TextDecoder().decode(data);
      const lines = text.trim().split('\n');
      const headers = lines[0]?.split(',').map((h) => h.trim()) ?? [];

      respond({
        type: 'result',
        id,
        data: { rowCount: lines.length - 1, columns: headers },
      });
    } else {
      respond({ type: 'error', id, message: 'Rayforce format not yet implemented' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Load error';
    respond({ type: 'error', id, message: msg });
  }
}

function handleCancel(id: string): void {
  console.log(`[Worker] Cancel requested for ${id}`);
}

function respond(message: WorkerResponse): void {
  self.postMessage(message);
}
