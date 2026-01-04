/**
 * Rayforce WASM Worker
 *
 * Runs RayforceDB in a Web Worker for non-blocking computation.
 * Includes Emscripten FS access for native read-csv support.
 */

import type { WorkerRequest, WorkerResponse } from '../core/model/types';

// SDK interface
interface RayforceSDK {
  version: string;
  eval(code: string, sourceName?: string): RayObject;
  format(obj: RayObject | number): string;
  table(columns: Record<string, unknown[]>): RayObject;
  symbol(value: string): RayObject;
  set(name: string, value: RayObject | unknown): void;
  get(name: string): RayObject;
}

interface RayObject {
  ptr: number;
  type: number;
  isError: boolean;
  length: number;
  toString(): string;
  toJS(): unknown;
  drop(): void;
}

// Emscripten FS interface
interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string, opts?: { encoding?: string }): string | Uint8Array;
  mkdir(path: string): void;
  stat(path: string): { size: number };
  unlink(path: string): void;
}

interface WasmModule {
  FS: EmscriptenFS;
}

// Module state
let sdk: RayforceSDK | null = null;
let wasmModule: WasmModule | null = null;
let version = '';
let initialized = false;

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
        
      case 'write_file':
        handleWriteFile(message.id, (message as any).path, (message as any).content);
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
  if (initialized && sdk) {
    respond({ type: 'ready', version });
    return;
  }

  try {
    console.log('[Worker] Initializing Rayforce WASM...');

    const jsUrl = new URL('/rayforce/rayforce.js', self.location.origin).href;
    const sdkUrl = new URL('/rayforce/rayforce.sdk.js', self.location.origin).href;
    const wasmUrl = new URL('/rayforce/rayforce.wasm', self.location.origin).href;
    
    // Fetch and patch the WASM loader
    const response = await fetch(jsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch rayforce.js: ${response.status}`);
    }
    
    let code = await response.text();
    code = code.replace(
      /new URL\s*\(\s*["']rayforce\.wasm["']\s*,\s*import\.meta\.url\s*\)/g,
      `"${wasmUrl}"`
    );
    
    const blob = new Blob([code], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    
    const wasmLoaderModule = await import(/* @vite-ignore */ blobUrl);
    URL.revokeObjectURL(blobUrl);
    
    const createRayforce = wasmLoaderModule.default;
    if (!createRayforce) {
      throw new Error('createRayforce not found in module');
    }
    
    console.log('[Worker] Creating WASM module...');

    // Create the WASM module - keep reference for FS access
    wasmModule = await createRayforce({
      locateFile: (path: string) => {
        if (path.endsWith('.wasm')) {
          return wasmUrl;
        }
        return path;
      },
    }) as WasmModule;

    // Create /tmp directory in virtual FS
    try {
      wasmModule.FS.mkdir('/tmp');
    } catch (e) {
      // Directory might already exist
    }

    console.log('[Worker] WASM module created, FS available:', !!wasmModule.FS);

    // Load SDK
    const sdkResponse = await fetch(sdkUrl);
    if (!sdkResponse.ok) {
      throw new Error(`Failed to fetch SDK: ${sdkResponse.status}`);
    }
    
    const sdkCode = await sdkResponse.text();
    const sdkBlob = new Blob([sdkCode], { type: 'application/javascript' });
    const sdkBlobUrl = URL.createObjectURL(sdkBlob);
    
    const sdkModule = await import(/* @vite-ignore */ sdkBlobUrl);
    URL.revokeObjectURL(sdkBlobUrl);
    
    const { createRayforceSDK } = sdkModule;
    if (!createRayforceSDK) {
      throw new Error('createRayforceSDK not found in SDK module');
    }

    sdk = createRayforceSDK(wasmModule) as RayforceSDK;
    version = sdk.version;

    initialized = true;
    console.log('[Worker] Rayforce SDK ready:', version);
    respond({ type: 'ready', version });
  } catch (error) {
    console.error('[Worker] Init error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to initialize WASM';
    respond({ type: 'error', id: 'init', message: msg });
  }
}

function handleWriteFile(id: string, path: string, content: string): void {
  if (!wasmModule?.FS) {
    respond({ type: 'error', id, message: 'FS not available' });
    return;
  }

  try {
    console.log('[Worker] Writing file:', path, 'size:', content.length);
    wasmModule.FS.writeFile(path, content);
    
    // Verify
    const stat = wasmModule.FS.stat(path);
    console.log('[Worker] File written, size:', stat.size);
    
    respond({ type: 'result', id, data: { path, size: stat.size } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Write error';
    respond({ type: 'error', id, message: msg });
  }
}

function handleEval(id: string, expression: string): void {
  if (!sdk) {
    respond({ type: 'error', id, message: 'SDK not initialized' });
    return;
  }

  try {
    const result = sdk.eval(expression);
    
    if (result.isError) {
      const errMsg = result.toString();
      result.drop();
      respond({ type: 'error', id, message: errMsg });
      return;
    }

    const resultStr = result.toString();
    result.drop();

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
  if (!sdk || !wasmModule?.FS) {
    respond({ type: 'error', id, message: 'SDK not initialized' });
    return;
  }

  try {
    if (format === 'csv') {
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
