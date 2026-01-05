/**
 * RayforceDB Client
 * 
 * Uses the local WASM SDK for:
 * - Local query execution
 * - Deserializing binary data from server
 * - Zero-copy TypedArray access to columnar data
 * 
 * Query Syntax Extensions:
 * - @local - Force local WASM execution
 * - @remote - Force remote server execution
 * - @timeout:N - Set timeout in ms (default 30000)
 */

import { logInfo, logError, logDebug, logWarn } from './logger';

// Rayforce type constants
const Types = {
  LIST: 0,
  B8: 1,
  U8: 2,
  I16: 3,
  I32: 4,
  I64: 5,
  SYMBOL: 6,
  DATE: 7,
  TIME: 8,
  TIMESTAMP: 9,
  F64: 10,
  GUID: 11,
  C8: 12,
  TABLE: 98,
  DICT: 99,
  LAMBDA: 100,
  NULL: 126,
  ERR: 127,
} as const;

// Type definitions for the SDK
interface RayforceSDK {
  eval(code: string, source?: string): RayObject;
  version: string;
  _deserialize(bufferPtr: number): number;
  _wrapPtr(ptr: number): RayObject;
  _wasm: EmscriptenModule;
  _evalRaw(code: string): number;
  _dropObj(ptr: number): void;
  _strOfObj(ptr: number): string;
  table(columns: Record<string, unknown[]>): Table;
  vector(type: number, data: unknown[] | number): Vector;
  set(name: string, value: unknown): void;
  get(name: string): RayObject;
}

interface EmscriptenModule {
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: unknown[]) => unknown;
  ccall: (name: string, returnType: string, argTypes: string[], args: unknown[]) => unknown;
}

interface RayObject {
  ptr: number;
  type: number;
  isAtom: boolean;
  isVector: boolean;
  isNull: boolean;
  isError: boolean;
  length: number;
  toJS(): unknown;
  toString(): string;
  drop(): void;
}

interface Vector extends RayObject {
  typedArray: ArrayBufferView;
  at(idx: number): unknown;
}

interface Table extends RayObject {
  columnNames(): string[];
  col(name: string): Vector;
  row(idx: number): RayObject;
  rowCount: number;
  toJS(): Record<string, unknown[]>;
  toRows(): Record<string, unknown>[];
}


// IPC header constants (from rayforce/core/serde.h)
// Header: prefix(4) version(1) flags(1) endian(1) msgtype(1) size(8) = 16 bytes
const IPC_PREFIX = 0xcefadefa;
const IPC_HEADER_SIZE = 16;

export interface RayforceResult {
  type: 'table' | 'scalar' | 'vector' | 'error' | 'null';
  /** Raw RayObject from WASM - use for zero-copy access */
  rayObject?: RayObject;
  /** JS representation (lazy, only computed when needed) */
  data?: unknown;
  columns?: string[];
  rowCount?: number;
  executionTime?: number;
  source?: 'local' | 'remote';
  
  /** Get column as TypedArray (zero-copy) */
  getColumn?: (name: string) => ArrayBufferView | null;
  /** Convert to JS (use sparingly, triggers full copy) */
  toJS?: () => unknown;
}

// Query directive parsing
interface QueryDirectives {
  code: string;
  forceLocal: boolean;
  forceRemote: boolean;
  timeout: number;
}

function parseQueryDirectives(rawCode: string): QueryDirectives {
  let code = rawCode.trim();
  let forceLocal = false;
  let forceRemote = false;
  let timeout = 30000;

  // Parse directives (lines starting with @)
  const lines = code.split('\n');
  const codeLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@local')) {
      forceLocal = true;
    } else if (trimmed.startsWith('@remote')) {
      forceRemote = true;
    } else if (trimmed.startsWith('@timeout:')) {
      const t = parseInt(trimmed.slice(9), 10);
      if (!isNaN(t)) timeout = t;
    } else if (!trimmed.startsWith('@')) {
      codeLines.push(line);
    }
  }

  return {
    code: codeLines.join('\n').trim(),
    forceLocal,
    forceRemote,
    timeout,
  };
}

type EventCallback = (data: unknown) => void;

/**
 * Rayforce client with local WASM execution and optional remote connection
 */
export class RayforceClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private pendingRequests: Map<number, { resolve: (value: RayforceResult) => void; reject: (error: Error) => void }> = new Map();
  private requestId = 0;
  private sdk: RayforceSDK | null = null;

  constructor() {
    // SDK loaded on demand
  }

  /**
   * Load the WASM SDK
   */
  async loadSDK(): Promise<void> {
    if (this.sdk) return;

    logInfo('Rayforce', 'Loading WASM SDK...');
    
    // Wait for SDK to be pre-initialized by index.html
    const sdk = await this.waitForSDK();
    
    if (!sdk) {
      const err = (window as unknown as { __rayforceError?: Error }).__rayforceError;
      throw new Error(err?.message || 'Failed to load WASM SDK');
    }
    
    this.sdk = sdk;
    
    logInfo('Rayforce', `SDK loaded, version: ${this.sdk.version}`);
  }

  /**
   * Wait for SDK to be pre-initialized by index.html
   */
  private waitForSDK(): Promise<RayforceSDK | null> {
    return new Promise((resolve) => {
      const checkInterval = 100;
      const maxWait = 15000;
      let waited = 0;

      const check = () => {
        const sdk = (window as unknown as { __rayforceSDK?: RayforceSDK }).__rayforceSDK;
        const err = (window as unknown as { __rayforceError?: Error }).__rayforceError;
        
        if (sdk) {
          logDebug('Rayforce', 'Pre-initialized SDK found');
          resolve(sdk);
          return;
        }
        
        if (err) {
          logError('Rayforce', `SDK init error: ${err.message}`);
          resolve(null);
          return;
        }
        
        waited += checkInterval;
        if (waited >= maxWait) {
          logError('Rayforce', 'Timeout waiting for SDK initialization');
          resolve(null);
          return;
        }
        
        setTimeout(check, checkInterval);
      };
      
      check();
    });
  }

  /**
   * Connect to remote Rayforce server with IPC handshake
   * 
   * Rayforce IPC Handshake (from core/ipc.c):
   * - Client sends: [RAYFORCE_VERSION][0x00] (2 bytes: version + null terminator)
   * - Server responds: [RAYFORCE_VERSION] (1 byte)
   */
  async connect(url: string): Promise<void> {
    // Ensure SDK is loaded first
    await this.loadSDK();

    return new Promise((resolve, reject) => {
      logInfo('Rayforce', `Connecting to: ${url}`);
      
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';
      
      let handshakeComplete = false;

      this.ws.onopen = () => {
        logInfo('Rayforce', 'WebSocket connected, sending Rayforce IPC handshake...');
        
        // Rayforce IPC handshake: [version][0x00] (2 bytes)
        // RAYFORCE_VERSION is typically 0x03
        const RAYFORCE_VERSION = 0x03;
        const handshake = new Uint8Array([RAYFORCE_VERSION, 0x00]);
        
        logDebug('Rayforce', `Sending IPC handshake: version=${RAYFORCE_VERSION} (${handshake.length} bytes)`);
        this.ws!.send(handshake.buffer);
      };

      this.ws.onmessage = (event) => {
        // First message should be handshake response (1 byte: version)
        if (!handshakeComplete) {
          const data = event.data;
          
          if (data instanceof ArrayBuffer) {
            const view = new Uint8Array(data);
            if (view.length >= 1) {
              const serverVersion = view[0];
              logInfo('Rayforce', `IPC handshake complete, server version: ${serverVersion}`);
              handshakeComplete = true;
              this.connected = true;
              this.emit('connected', { version: serverVersion });
              resolve();
              return;
            }
          }
          
          // If handshake response is not as expected, try to continue anyway
          logWarn('Rayforce', 'Unexpected handshake response, proceeding anyway');
          handshakeComplete = true;
          this.connected = true;
          this.emit('connected', null);
          resolve();
          
          // Process this message as a normal message
          this.handleMessage(event.data);
          return;
        }
        
        // Normal message processing
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        logError('Rayforce', 'WebSocket error', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        logWarn('Rayforce', `Disconnected: code=${event.code} reason=${event.reason || 'none'}`);
        this.connected = false;
        handshakeComplete = false;
        this.emit('disconnected', null);
      };
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Execute query locally using WASM
   */
  evalLocal(code: string): RayforceResult {
    if (!this.sdk) {
      const err = 'SDK not loaded. Call loadSDK() first.';
      logError('Rayforce', err);
      throw new Error(err);
    }

    const startTime = performance.now();
    logDebug('Query', `[LOCAL] ${code}`);

    try {
      const result = this.sdk.eval(code);
      const execTime = performance.now() - startTime;
      const wrapped = this.wrapResult(result);
      wrapped.executionTime = execTime;
      wrapped.source = 'local';
      
      logInfo('Query', `[LOCAL] Complete in ${execTime.toFixed(2)}ms, type: ${wrapped.type}`);
      return wrapped;
    } catch (error) {
      const execTime = performance.now() - startTime;
      logError('Query', `[LOCAL] Failed: ${error}`);
      return {
        type: 'error',
        data: String(error),
        executionTime: execTime,
        source: 'local',
      };
    }
  }

  /**
   * Execute query - automatically chooses local or remote based on directives and connection
   */
  async execute(rawCode: string): Promise<RayforceResult> {
    const { code, forceLocal, forceRemote, timeout } = parseQueryDirectives(rawCode);
    
    // Determine execution target
    if (forceLocal) {
      return this.evalLocal(code);
    }
    
    if (forceRemote) {
      if (!this.isConnected()) {
        return { type: 'error', data: '@remote specified but not connected to server', source: 'remote' };
      }
      return this.query(code, timeout);
    }
    
    // Default: prefer remote if connected, else local
    if (this.isConnected()) {
      return this.query(code, timeout);
    }
    
    return this.evalLocal(code);
  }

  /**
   * Execute query on remote server
   */
  async query(code: string, timeout = 30000): Promise<RayforceResult> {
    if (!this.isConnected()) {
      const err = 'Not connected to server';
      logError('Rayforce', err);
      throw new Error(err);
    }

    const startTime = performance.now();
    logDebug('Query', `[REMOTE] ${code}`);

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      
      const handleResult = (result: RayforceResult) => {
        const execTime = performance.now() - startTime;
        result.executionTime = execTime;
        result.source = 'remote';
        
        if (result.type === 'error') {
          logError('Query', `[REMOTE] Failed: ${result.data}`);
        } else {
          logInfo('Query', `[REMOTE] Complete in ${execTime.toFixed(2)}ms, type: ${result.type}`);
        }
        resolve(result);
      };
      
      this.pendingRequests.set(id, { resolve: handleResult, reject });

      // Send as text message - server's _process_text_message uses eval_str
      this.ws!.send(code);

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          logError('Query', `[REMOTE] Timeout after ${timeout}ms`);
          reject(new Error(`Query timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(data: ArrayBuffer | string): void {
    // Handle text error messages
    if (typeof data === 'string') {
      logDebug('Rayforce', `Received text: ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
      try {
        const json = JSON.parse(data);
        if (json.error) {
          logError('Rayforce', `Server error: ${json.error}`);
          this.resolvePending({ type: 'error', data: json.error });
          return;
        }
      } catch {
        logWarn('Rayforce', `Unexpected text response: ${data}`);
      }
      return;
    }

    // Binary data - parse IPC response
    const buffer = new Uint8Array(data);
    logDebug('Rayforce', `Received binary: ${buffer.length} bytes`);

    // Parse IPC header: prefix(4) version(1) flags(1) endian(1) msgtype(1) size(8)
    const view = new DataView(data);
    const prefix = view.getUint32(0, true); // little-endian
    
    if (prefix !== IPC_PREFIX) {
      // Show first 32 bytes for debugging
      const hexBytes = Array.from(buffer.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      logError('Rayforce', `Invalid IPC prefix: 0x${prefix.toString(16)}. Expected: 0x${IPC_PREFIX.toString(16)}. First 32 bytes: ${hexBytes}`);
      this.resolvePending({ type: 'error', data: `Invalid IPC response (prefix: 0x${prefix.toString(16)})` });
      return;
    }

    // Parse header fields
    const version = view.getUint8(4);
    const flags = view.getUint8(5);
    const endian = view.getUint8(6); // 0 = little, 1 = big
    const msgType = view.getUint8(7); // 0 = sync, 1 = response, 2 = async
    const isLittleEndian = endian === 0;
    const payloadSize = Number(view.getBigInt64(8, isLittleEndian));
    
    logDebug('Rayforce', `IPC Header: version=${version}, flags=${flags}, endian=${endian}, msgType=${msgType}, size=${payloadSize}`);

    // Extract payload (skip 16-byte header)
    const payload = buffer.slice(IPC_HEADER_SIZE, IPC_HEADER_SIZE + payloadSize);
    
    logDebug('Rayforce', `Payload: ${payload.length} bytes`);
    
    // Use SDK to deserialize
    const result = this.deserializePayload(payload);
    this.resolvePending(result);
  }

  /**
   * Deserialize binary payload
   * Since remote server sends serialized Rayforce objects, we parse them manually
   * and create equivalent objects in local WASM
   */
  private deserializePayload(payload: Uint8Array): RayforceResult {
    if (!this.sdk) {
      return { type: 'error', data: 'SDK not loaded' };
    }
    
    try {
      if (payload.length === 0) {
        return { type: 'null', data: null };
      }
      
      // Parse the serialized format manually and recreate in WASM
      const parsed = this.parseSerializedData(payload);
      return parsed;
    } catch (error) {
      logError('Rayforce', `Deserialize error: ${error}`);
      const hexDump = Array.from(payload.slice(0, Math.min(64, payload.length)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      logDebug('Rayforce', `Payload hex (${payload.length} bytes): ${hexDump}`);
      return { type: 'error', data: `Deserialize error: ${error}` };
    }
  }
  
  /**
   * Parse serialized Rayforce data and recreate as WASM objects
   */
  private parseSerializedData(payload: Uint8Array): RayforceResult {
    const view = new DataView(payload.buffer, payload.byteOffset, payload.length);
    const type = view.getInt8(0);
    
    logDebug('Rayforce', `parseSerializedData: type=${type} (${type < 0 ? 'atom' : type === 0 ? 'list' : type === 98 ? 'table' : type === 99 ? 'dict' : 'vector'}), payload length=${payload.length}`);
    
    // Negative type = atom (scalar)
    if (type < 0) {
      const atomType = -type;
      const result = this.parseAtom(view, 1, atomType);
      console.log('[Rayforce] Parsed SCALAR atom:', { atomType, result });
      return result;
    }
    
    // Type 0 = list, 98 = table, 99 = dict
    if (type === Types.TABLE) {
      return this.parseTable(view, 1);
    }
    
    if (type === Types.DICT) {
      return this.parseDict(view, 1);
    }
    
    if (type === Types.LIST) {
      return this.parseList(view, 1);
    }
    
    if (type === Types.NULL) {
      return { type: 'null', data: null };
    }
    
    if (type === Types.ERR) {
      return this.parseError(view, 1);
    }
    
    // Positive type = vector
    const vectorResult = this.parseVector(view, 1, type);
    console.log('[Rayforce] Parsed VECTOR:', { type, length: (vectorResult.data as unknown[])?.length, first3: (vectorResult.data as unknown[])?.slice?.(0, 3) });
    return vectorResult;
  }
  
  private parseAtom(view: DataView, offset: number, type: number): RayforceResult {
    switch (type) {
      case Types.B8:
        return { type: 'scalar', data: view.getUint8(offset) !== 0 };
      case Types.U8:
        return { type: 'scalar', data: view.getUint8(offset) };
      case Types.I16:
        return { type: 'scalar', data: view.getInt16(offset, true) };
      case Types.I32:
      case Types.DATE:
      case Types.TIME:
        return { type: 'scalar', data: view.getInt32(offset, true) };
      case Types.I64:
      case Types.TIMESTAMP:
        return { type: 'scalar', data: Number(view.getBigInt64(offset, true)) };
      case Types.F64:
        return { type: 'scalar', data: view.getFloat64(offset, true) };
      case Types.SYMBOL: {
        let str = '';
        while (offset < view.byteLength && view.getUint8(offset) !== 0) {
          str += String.fromCharCode(view.getUint8(offset));
          offset++;
        }
        return { type: 'scalar', data: str };
      }
      case Types.C8:
        return { type: 'scalar', data: String.fromCharCode(view.getUint8(offset)) };
      default:
        return { type: 'scalar', data: null };
    }
  }
  
  private parseVector(view: DataView, offset: number, type: number): RayforceResult {
    // Skip attrs byte
    offset += 1;
    const len = Number(view.getBigInt64(offset, true));
    offset += 8;
    
    const data: unknown[] = [];
    
    for (let i = 0; i < len && offset < view.byteLength; i++) {
      switch (type) {
        case Types.B8:
          data.push(view.getUint8(offset) !== 0);
          offset += 1;
          break;
        case Types.U8:
          data.push(view.getUint8(offset));
          offset += 1;
          break;
        case Types.C8:
          data.push(String.fromCharCode(view.getUint8(offset)));
          offset += 1;
          break;
        case Types.I16:
          data.push(view.getInt16(offset, true));
          offset += 2;
          break;
        case Types.I32:
        case Types.DATE:
        case Types.TIME:
          data.push(view.getInt32(offset, true));
          offset += 4;
          break;
        case Types.I64:
        case Types.TIMESTAMP:
          data.push(Number(view.getBigInt64(offset, true)));
          offset += 8;
          break;
        case Types.F64:
          data.push(view.getFloat64(offset, true));
          offset += 8;
          break;
        case Types.SYMBOL: {
          let str = '';
          while (offset < view.byteLength && view.getUint8(offset) !== 0) {
            str += String.fromCharCode(view.getUint8(offset));
            offset++;
          }
          offset++; // null terminator
          data.push(str);
          break;
        }
        default:
          data.push(null);
      }
    }
    
    // For char vectors, return as string
    if (type === Types.C8) {
      return { type: 'scalar', data: data.join('') };
    }
    
    return { type: 'vector', data };
  }
  
  private parseTable(view: DataView, offset: number): RayforceResult {
    // Use the internal parser
    const { columns, columnData } = this.parseTableInternal(view, offset);
    
    // Convert to row format
    const rowCount = columnData[0]?.length || 0;
    const rows: Record<string, unknown>[] = [];
    
    for (let r = 0; r < rowCount; r++) {
      const row: Record<string, unknown> = {};
      for (let c = 0; c < columns.length; c++) {
        row[columns[c]] = columnData[c]?.[r];
      }
      rows.push(row);
    }
    
    // Create WASM table if SDK available
    if (this.sdk && columns.length > 0 && rowCount > 0) {
      try {
        const tableData: Record<string, unknown[]> = {};
        for (let c = 0; c < columns.length; c++) {
          tableData[columns[c]] = columnData[c] || [];
        }
        const wasmTable = this.sdk.table(tableData);
        return {
          type: 'table',
          rayObject: wasmTable,
          columns,
          rowCount,
          toJS: () => rows,
          getColumn: (name: string) => wasmTable.col(name)?.typedArray || null,
        };
      } catch {
        // Fall back to JS-only result
      }
    }
    
    return {
      type: 'table',
      data: rows,
      columns,
      rowCount,
      toJS: () => rows,
    };
  }
  
  private parseDict(view: DataView, offset: number): RayforceResult {
    // Dict type 99 can be:
    // 1. A keyed table (keys=table, values=table)
    // 2. A simple dict (keys=vector, values=vector/list)
    
    // Check first element type
    const keysType = view.getInt8(offset);
    
    if (keysType === Types.TABLE) {
      // This is a keyed table - parse as combined table
      return this.parseKeyedTable(view, offset);
    }
    
    // Simple dict: parse keys and values
    const { data: keys, bytesRead: keyBytes } = this.parseAnyWithSize(view, offset);
    offset += keyBytes;
    const { data: values } = this.parseAnyWithSize(view, offset);
    
    // If keys are symbols and values are vectors, create a table-like structure
    if (Array.isArray(keys) && Array.isArray(values)) {
      const dict: Record<string, unknown> = {};
      for (let i = 0; i < keys.length && i < values.length; i++) {
        dict[String(keys[i])] = values[i];
      }
      return { type: 'scalar', data: dict };
    }
    
    return { type: 'scalar', data: { keys, values } };
  }
  
  private parseKeyedTable(view: DataView, offset: number): RayforceResult {
    // Parse key table
    const keyTableResult = this.parseTableInternal(view, offset);
    offset += keyTableResult.bytesRead;
    
    // Parse value table
    const valueTableResult = this.parseTableInternal(view, offset);
    
    // Combine key and value columns
    const allColumns = [...keyTableResult.columns, ...valueTableResult.columns];
    const allColumnData = [...keyTableResult.columnData, ...valueTableResult.columnData];
    
    // Convert to row format
    const rowCount = allColumnData[0]?.length || 0;
    const rows: Record<string, unknown>[] = [];
    
    for (let r = 0; r < rowCount; r++) {
      const row: Record<string, unknown> = {};
      for (let c = 0; c < allColumns.length; c++) {
        row[allColumns[c]] = allColumnData[c]?.[r];
      }
      rows.push(row);
    }
    
    return {
      type: 'table',
      data: rows,
      columns: allColumns,
      rowCount,
      toJS: () => rows,
    };
  }
  
  private parseAnyWithSize(view: DataView, offset: number): { data: unknown; bytesRead: number } {
    const startOffset = offset;
    const type = view.getInt8(offset);
    offset += 1;
    
    // Atom (negative type)
    if (type < 0) {
      const atomType = -type;
      const atomSize = this.getAtomSize(atomType);
      if (atomType === Types.SYMBOL) {
        let str = '';
        while (offset < view.byteLength && view.getUint8(offset) !== 0) {
          str += String.fromCharCode(view.getUint8(offset));
          offset++;
        }
        offset++; // null terminator
        return { data: str, bytesRead: offset - startOffset };
      }
      return { 
        data: this.readAtomValue(view, offset, atomType), 
        bytesRead: 1 + atomSize 
      };
    }
    
    // Vector
    if (type > 0 && type < 20) {
      offset += 1; // attrs
      const len = Number(view.getBigInt64(offset, true));
      offset += 8;
      
      const data: unknown[] = [];
      const elemSize = this.getAtomSize(type);
      
      for (let i = 0; i < len && offset < view.byteLength; i++) {
        if (type === Types.SYMBOL) {
          let str = '';
          while (offset < view.byteLength && view.getUint8(offset) !== 0) {
            str += String.fromCharCode(view.getUint8(offset));
            offset++;
          }
          offset++;
          data.push(str);
        } else {
          data.push(this.readAtomValue(view, offset, type));
          offset += elemSize;
        }
      }
      
      return { data, bytesRead: offset - startOffset };
    }
    
    // For complex types, return empty and estimate size
    return { data: null, bytesRead: 1 };
  }
  
  private getAtomSize(type: number): number {
    switch (type) {
      case Types.B8:
      case Types.U8:
      case Types.C8:
        return 1;
      case Types.I16:
        return 2;
      case Types.I32:
      case Types.DATE:
      case Types.TIME:
        return 4;
      case Types.I64:
      case Types.F64:
      case Types.TIMESTAMP:
        return 8;
      default:
        return 0;
    }
  }
  
  private readAtomValue(view: DataView, offset: number, type: number): unknown {
    switch (type) {
      case Types.B8: return view.getUint8(offset) !== 0;
      case Types.U8: return view.getUint8(offset);
      case Types.C8: return String.fromCharCode(view.getUint8(offset));
      case Types.I16: return view.getInt16(offset, true);
      case Types.I32:
      case Types.DATE:
      case Types.TIME: return view.getInt32(offset, true);
      case Types.I64:
      case Types.TIMESTAMP: return Number(view.getBigInt64(offset, true));
      case Types.F64: return view.getFloat64(offset, true);
      default: return null;
    }
  }
  
  private parseTableInternal(view: DataView, offset: number): { 
    columns: string[]; 
    columnData: unknown[][]; 
    bytesRead: number;
  } {
    const startOffset = offset;
    
    // Skip table type byte if present
    if (view.getInt8(offset) === Types.TABLE) {
      offset += 1;
    }
    
    // Skip attrs
    offset += 1;
    
    // Parse column names (symbol vector)
    const keysType = view.getInt8(offset);
    offset += 1;
    
    const columns: string[] = [];
    if (keysType === Types.SYMBOL) {
      offset += 1; // attrs
      const keysLen = Number(view.getBigInt64(offset, true));
      offset += 8;
      
      for (let i = 0; i < keysLen && offset < view.byteLength; i++) {
        let str = '';
        while (offset < view.byteLength && view.getUint8(offset) !== 0) {
          str += String.fromCharCode(view.getUint8(offset));
          offset++;
        }
        offset++; // null terminator
        columns.push(str);
      }
    }
    
    // Parse values (list of vectors)
    const valsType = view.getInt8(offset);
    offset += 1;
    
    const columnData: unknown[][] = [];
    if (valsType === Types.LIST) {
      offset += 1; // attrs
      const valsLen = Number(view.getBigInt64(offset, true));
      offset += 8;
      
      for (let i = 0; i < valsLen && offset < view.byteLength; i++) {
        const colType = view.getInt8(offset);
        offset += 1;
        
        if (colType > 0 && colType < 20) {
          offset += 1; // attrs
          const colLen = Number(view.getBigInt64(offset, true));
          offset += 8;
          
          const col: unknown[] = [];
          const elemSize = this.getAtomSize(colType);
          
          for (let j = 0; j < colLen && offset < view.byteLength; j++) {
            if (colType === Types.SYMBOL) {
              let str = '';
              while (offset < view.byteLength && view.getUint8(offset) !== 0) {
                str += String.fromCharCode(view.getUint8(offset));
                offset++;
              }
              offset++;
              col.push(str);
            } else {
              col.push(this.readAtomValue(view, offset, colType));
              offset += elemSize;
            }
          }
          columnData.push(col);
        } else {
          // Unknown column type, push empty
          columnData.push([]);
        }
      }
    }
    
    return { columns, columnData, bytesRead: offset - startOffset };
  }
  
  private parseList(view: DataView, offset: number): RayforceResult {
    offset += 1; // attrs
    const len = Number(view.getBigInt64(offset, true));
    offset += 8;
    
    // Parse list elements
    const data: unknown[] = [];
    for (let i = 0; i < len && offset < view.byteLength; i++) {
      const { data: elem, bytesRead } = this.parseAnyWithSize(view, offset);
      data.push(elem);
      offset += bytesRead;
    }
    
    return { type: 'vector', data };
  }
  
  private parseError(view: DataView, offset: number): RayforceResult {
    const code = view.getUint8(offset);
    offset += 1;
    offset += 8; // skip context
    
    let msg = `Error code: ${code}`;
    if (code === 255) {
      let str = '';
      while (offset < view.byteLength && view.getUint8(offset) !== 0) {
        str += String.fromCharCode(view.getUint8(offset));
        offset++;
      }
      msg = str || msg;
    }
    
    return { type: 'error', data: msg };
  }
  
  /**
   * Wrap a RayObject into RayforceResult with zero-copy accessors
   */
  private wrapRayObject(obj: RayObject): RayforceResult {
    if (!obj || obj.isNull) {
      return { type: 'null', data: null };
    }
    
    if (obj.isError) {
      return { type: 'error', data: obj.toString() };
    }
    
    const type = Math.abs(obj.type);
    
    // Table
    if (type === Types.TABLE) {
      const table = obj as Table;
      const columns = table.columnNames();
      const rowCount = table.rowCount;
      
      return {
        type: 'table',
        rayObject: obj,
        columns,
        rowCount,
        // Zero-copy column access
        getColumn: (name: string) => {
          const col = table.col(name);
          if (!col) return null;
          return col.typedArray || null;
        },
        // Lazy JS conversion
        toJS: () => table.toRows(),
      };
    }
    
    // Vector
    if (obj.isVector) {
      const vec = obj as Vector;
      return {
        type: 'vector',
        rayObject: obj,
        // Zero-copy access for numeric vectors
        getColumn: () => vec.typedArray || null,
        toJS: () => obj.toJS(),
      };
    }
    
    // Scalar
    return {
      type: 'scalar',
      rayObject: obj,
      data: obj.toJS(),
      toJS: () => obj.toJS(),
    };
  }

  /**
   * Convert SDK object to RayforceResult (alias for wrapRayObject)
   */
  private wrapResult(obj: RayObject): RayforceResult {
    return this.wrapRayObject(obj);
  }

  /**
   * Resolve pending request
   */
  private resolvePending(result: RayforceResult): void {
    // Resolve the most recent pending request
    const entries = Array.from(this.pendingRequests.entries());
    if (entries.length > 0) {
      const [id, { resolve }] = entries[entries.length - 1];
      this.pendingRequests.delete(id);
      resolve(result);
    }
    
    // Also emit result event
    this.emit('result', result);
  }

  /**
   * Event emitter methods
   */
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach(cb => cb(data));
  }

  // ==========================================================================
  // Local data operations using WASM
  // ==========================================================================

  /**
   * Create a table locally
   */
  createTable(columns: Record<string, unknown[]>): Table | null {
    if (!this.sdk) return null;
    return this.sdk.table(columns);
  }

  /**
   * Set a global variable in the local WASM environment
   */
  setLocal(name: string, value: unknown): void {
    if (!this.sdk) return;
    this.sdk.set(name, value);
  }

  /**
   * Get SDK reference for advanced operations
   */
  getSDK(): RayforceSDK | null {
    return this.sdk;
  }
}

// Singleton instance
let clientInstance: RayforceClient | null = null;

export function getRayforceClient(): RayforceClient {
  if (!clientInstance) {
    clientInstance = new RayforceClient();
  }
  return clientInstance;
}
