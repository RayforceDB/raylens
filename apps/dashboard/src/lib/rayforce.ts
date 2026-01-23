/**
 * RayforceDB Client for Tauri
 *
 * Simplified client that uses Tauri IPC instead of WebSocket/WASM.
 * All heavy lifting happens in the Rust backend.
 */

import { invoke } from '@tauri-apps/api/core';
import { logInfo, logError, logDebug } from './logger';

// =============================================================================
// Types
// =============================================================================

/** Metadata about a query result */
export interface QueryMeta {
  handle: number;
  columns: string[];
  columnTypes: Record<string, string>;
  rowCount: number;
  resultType: 'table' | 'scalar' | 'vector' | 'dict' | 'error' | 'unknown';
}

/** A row of data from a table result */
export type Row = Record<string, unknown>;

/** Result from executing a query */
export interface RayforceResult {
  type: 'table' | 'scalar' | 'vector' | 'error' | 'null';
  meta?: QueryMeta;
  data?: unknown;
  columns?: string[];
  columnTypes?: Record<string, string>;
  rowCount?: number;
  executionTime?: number;
  source: 'native';
}

/** Scalar result for quick queries */
interface ScalarResult {
  value: unknown;
  typeName: string;
}

// =============================================================================
// Query Execution
// =============================================================================

/**
 * Execute a Rayfall query
 *
 * Returns metadata about the result. For tables, use getRows() to fetch data chunks.
 */
export async function executeQuery(queryId: string, code: string): Promise<QueryMeta> {
  logDebug('Rayforce', `Executing query: ${queryId}`);

  const startTime = performance.now();

  try {
    const meta = await invoke<QueryMeta>('execute_query', { queryId, code });
    const execTime = performance.now() - startTime;

    logInfo('Rayforce', `Query complete in ${execTime.toFixed(2)}ms: ${meta.resultType}, ${meta.rowCount} rows`);

    return meta;
  } catch (error) {
    logError('Rayforce', `Query failed: ${error}`);
    throw error;
  }
}

/**
 * Execute a query and get all data (for small results)
 *
 * Convenience wrapper that executes and fetches all rows.
 * Use executeQuery + getRows for large results with pagination.
 */
export async function execute(code: string): Promise<RayforceResult> {
  const queryId = `q_${Date.now()}`;
  const startTime = performance.now();

  try {
    const meta = await executeQuery(queryId, code);
    const execTime = performance.now() - startTime;

    if (meta.resultType === 'error') {
      return {
        type: 'error',
        data: 'Query error',
        executionTime: execTime,
        source: 'native',
      };
    }

    if (meta.resultType === 'table') {
      // Fetch all rows (for small tables)
      const rows = await getRows(meta.handle, 0, meta.rowCount);

      return {
        type: 'table',
        meta,
        data: rows,
        columns: meta.columns,
        columnTypes: meta.columnTypes,
        rowCount: meta.rowCount,
        executionTime: execTime,
        source: 'native',
      };
    }

    // For scalars/vectors, fetch the value
    const rows = await getRows(meta.handle, 0, 1);
    await releaseHandle(meta.handle);

    return {
      type: meta.resultType as 'scalar' | 'vector',
      data: rows[0] ?? null,
      executionTime: execTime,
      source: 'native',
    };
  } catch (error) {
    return {
      type: 'error',
      data: String(error),
      executionTime: performance.now() - startTime,
      source: 'native',
    };
  }
}

/**
 * Execute a scalar query (quick, no handle management)
 */
export async function executeScalar(code: string): Promise<unknown> {
  const result = await invoke<ScalarResult>('execute_scalar', { code });
  return result.value;
}

// =============================================================================
// Data Fetching
// =============================================================================

/**
 * Get rows from a query result
 *
 * Use this for virtual scrolling / pagination of large tables.
 */
export async function getRows(handle: number, start: number, count: number): Promise<Row[]> {
  logDebug('Rayforce', `Fetching rows: handle=${handle}, start=${start}, count=${count}`);

  const rows = await invoke<Row[]>('get_rows', { handle, start, count });

  logDebug('Rayforce', `Fetched ${rows.length} rows`);

  return rows;
}

// =============================================================================
// Handle Management
// =============================================================================

/**
 * Release a query result handle
 *
 * Call this when:
 * - A widget unmounts
 * - A query is re-executed (old handle should be released)
 * - Data is no longer needed
 */
export async function releaseHandle(handle: number): Promise<void> {
  logDebug('Rayforce', `Releasing handle: ${handle}`);
  await invoke('release_handle', { handle });
}

/**
 * Cancel a pending query
 *
 * If the query is still running, its result will be discarded.
 */
export async function cancelQuery(queryId: string): Promise<void> {
  logDebug('Rayforce', `Cancelling query: ${queryId}`);
  await invoke('cancel_query', { queryId });
}

// =============================================================================
// Client Class (for backwards compatibility)
// =============================================================================

/**
 * RayforceClient class for backwards compatibility
 *
 * Most code should use the standalone functions directly.
 */
export class RayforceClient {
  private handles: Map<string, number> = new Map();

  constructor() {
    logInfo('Rayforce', 'Native Tauri client initialized');
  }

  /**
   * Load SDK - no-op for Tauri (native is always ready)
   */
  async loadSDK(): Promise<void> {
    // No-op - native Rayforce is initialized by the Rust backend
    logInfo('Rayforce', 'SDK ready (native)');
  }

  /**
   * Connect - no-op for Tauri (embedded, no server)
   */
  async connect(_url: string): Promise<void> {
    // No-op - Rayforce is embedded in the Tauri app
    logInfo('Rayforce', 'Connected (embedded)');
  }

  /**
   * Disconnect - no-op for Tauri
   */
  disconnect(): void {
    // No-op
  }

  /**
   * Check if connected - always true for embedded
   */
  isConnected(): boolean {
    return true;
  }

  /**
   * Execute a query
   */
  async execute(code: string): Promise<RayforceResult> {
    return execute(code);
  }

  /**
   * Execute locally - same as execute for embedded
   */
  evalLocal(code: string): RayforceResult {
    // For backwards compatibility, but this should be async
    // Returning a placeholder - actual implementation should use execute()
    return {
      type: 'error',
      data: 'Use execute() for async queries',
      source: 'native',
    };
  }
}

// =============================================================================
// Singleton
// =============================================================================

let clientInstance: RayforceClient | null = null;

export function getRayforceClient(): RayforceClient {
  if (!clientInstance) {
    clientInstance = new RayforceClient();
  }
  return clientInstance;
}
