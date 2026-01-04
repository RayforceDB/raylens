import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  ColumnSchema,
  ColumnStatistics,
  ColumnarResult,
  QueryPlan,
  RayforceType,
  Selection,
  ShelfConfiguration,
  ChartType,
} from '@core/model/types';
import { RayforceWorkerBridge } from '@core/rayforce/bridge';

// ============================================================================
// Combined Store Type
// ============================================================================

export interface RayLensStore {
  // Rayforce WASM engine state
  status: 'idle' | 'loading' | 'ready' | 'error';
  version: string | null;
  error: string | null;
  bridge: RayforceWorkerBridge | null;

  // Dataset metadata
  dataset: {
    id: string;
    name: string;
    schema: ColumnSchema[];
    statistics: ColumnStatistics[];
    rowCount: number;
    source: 'local' | 'remote';
  } | null;
  datasetLoading: boolean;
  datasetError: string | null;

  // Query specification
  queryPlan: QueryPlan;
  queryState: {
    status: 'idle' | 'local_pending' | 'remote_pending' | 'streaming' | 'complete' | 'error';
    localResult: ColumnarResult | null;
    remoteResult: ColumnarResult | null;
    streamProgress: number;
    cancelToken: string | null;
    error: string | null;
  };

  // Selection state
  selection: Selection;

  // Layout state
  shelves: ShelfConfiguration;
  chartType: ChartType;
  chartTypeAuto: boolean;
  sidebarOpen: boolean;

  // Actions
  init: () => Promise<void>;
  eval: (expression: string) => Promise<unknown>;
  loadSampleData: () => Promise<void>;
  loadCSVData: (file: File) => Promise<void>;
  clearDataset: () => void;
  setBrush: (column: string, range: { min: number; max: number } | null) => void;
  clearAllSelections: () => void;
  setShelf: (shelf: keyof ShelfConfiguration, columns: string[]) => void;
  addToShelf: (shelf: keyof ShelfConfiguration, column: string) => void;
  removeFromShelf: (shelf: keyof ShelfConfiguration, column: string) => void;
  setChartType: (type: ChartType, auto?: boolean) => void;
  toggleSidebar: () => void;
  
  // Visualization encoding actions (for Tableau-like interface)
  addColumnToRows: (column: string) => void;
  addColumnToColumns: (column: string) => void;
  addColumnToValues: (column: string, aggregation?: string) => void;
  removeColumnFromRows: (index: number) => void;
  removeColumnFromColumns: (index: number) => void;
  removeColumnFromValues: (index: number) => void;
}

// ============================================================================
// Default Values
// ============================================================================

const defaultQueryPlan: QueryPlan = {
  source: '',
  projections: [],
  filters: [],
  groupings: [],
  orderings: [],
  limit: 1000,
  offset: 0,
};

const defaultSelection: Selection = {
  brushRanges: new Map(),
  selectedCategories: new Map(),
  selectedRows: new Set(),
  filteredIndices: null,
};

const defaultShelves: ShelfConfiguration = {
  rows: [],
  columns: [],
  filters: [],
  color: null,
  size: null,
};

// ============================================================================
// Helper: Manual CSV loading fallback (limited rows)
// ============================================================================

async function loadCSVManually(
  bridge: RayforceWorkerBridge,
  tableName: string,
  headers: string[],
  colTypes: Record<string, string>,
  lines: string[],
  maxRows: number
): Promise<void> {
  const rowsToLoad = Math.min(lines.length - 1, maxRows);
  
  // Collect data
  const columns: Record<string, string[]> = {};
  headers.forEach((h) => { columns[h] = []; });
  
  for (let i = 1; i <= rowsToLoad; i++) {
    const values = lines[i]?.split(',') ?? [];
    headers.forEach((h, idx) => {
      columns[h]?.push(values[idx]?.trim() ?? '');
    });
  }
  
  // Build Rayfall expression
  const cleanHeaders = headers.map((h) => h.replace(/[^a-zA-Z0-9_]/g, '_'));
  const colList = cleanHeaders.join(' ');
  
  const dataLists = headers.map((h, _idx) => {
    const vals = columns[h] ?? [];
    const type = colTypes[h] ?? 'SYMBOL';
    
    if (type === 'I64' || type === 'F64') {
      const nums = vals.map((v) => v === '' ? '0n' : (isNaN(Number(v)) ? '0n' : v));
      return `[${nums.join(' ')}]`;
    } else {
      // Symbols
      const syms = vals.map((v) => {
        if (!v) return 'nil';
        let s = v.replace(/[^a-zA-Z0-9_]/g, '_');
        if (/^[0-9]/.test(s)) s = '_' + s;
        return s;
      });
      return `[${syms.join(' ')}]`;
    }
  }).join(' ');
  
  const expr = `(set ${tableName} (table [${colList}] (list ${dataLists})))`;
  console.log('[Store] Manual load:', expr.substring(0, 200) + '...');
  
  await bridge.eval(expr);
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useRayLensStore = create<RayLensStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        status: 'idle',
        version: null,
        error: null,
        bridge: null,
        dataset: null,
        datasetLoading: false,
        datasetError: null,
        queryPlan: defaultQueryPlan,
        queryState: {
          status: 'idle',
          localResult: null,
          remoteResult: null,
          streamProgress: 0,
          cancelToken: null,
          error: null,
        },
        selection: defaultSelection,
        shelves: defaultShelves,
        chartType: 'table',
        chartTypeAuto: true,
        sidebarOpen: true,

        // ====================================================================
        // Rayforce Actions
        // ====================================================================

        init: async () => {
          if (get().status === 'loading' || get().status === 'ready') {
            return;
          }

          set((state) => {
            state.status = 'loading';
            state.error = null;
          });

          try {
            const bridge = new RayforceWorkerBridge();
            const { version } = await bridge.init();

            set((state) => {
              state.status = 'ready';
              state.version = version;
              state.bridge = bridge as RayforceWorkerBridge;
            });

            console.log(`[RayLens] Rayforce WASM initialized: ${version}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            set((state) => {
              state.status = 'error';
              state.error = message;
            });
            console.error('[RayLens] Failed to initialize Rayforce:', err);
          }
        },

        eval: async (expression: string) => {
          const { bridge, status } = get();
          if (status !== 'ready' || !bridge) {
            throw new Error('Rayforce not initialized');
          }
          return bridge.eval(expression);
        },

        // ====================================================================
        // Dataset Actions
        // ====================================================================

        loadSampleData: async () => {
          set((state) => {
            state.datasetLoading = true;
            state.datasetError = null;
          });

          try {
            // FAA Wildlife Strikes-like sample data schema
            const mockSchema: ColumnSchema[] = [
              { name: 'Airport', type: 'symbol', nullable: false },
              { name: 'Species', type: 'symbol', nullable: false },
              { name: 'Incident Date', type: 'timestamp', nullable: false },
              { name: 'Damage', type: 'symbol', nullable: true },
              { name: 'Effect', type: 'symbol', nullable: true },
              { name: 'Phase Of Fit', type: 'symbol', nullable: true },
              { name: 'Height', type: 'f64', nullable: true },
              { name: 'Speed', type: 'f64', nullable: true },
              { name: 'Cost Repairs', type: 'f64', nullable: true },
              { name: 'State', type: 'symbol', nullable: false },
              { name: 'Operator', type: 'symbol', nullable: true },
              { name: 'Remarks', type: 'c8', nullable: true },
            ];

            const mockStats: ColumnStatistics[] = [
              {
                column: 'Airport',
                count: 73448,
                nullCount: 0,
                distinctEstimate: 2000,
              },
              {
                column: 'Species',
                count: 73448,
                nullCount: 0,
                distinctEstimate: 641,
              },
              {
                column: 'Incident Date',
                count: 73448,
                nullCount: 0,
                distinctEstimate: 5000,
                minDate: new Date('2000-01-01'),
                maxDate: new Date('2015-12-31'),
              },
              {
                column: 'Damage',
                count: 73448,
                nullCount: 5000,
                distinctEstimate: 4,
              },
              {
                column: 'Effect',
                count: 73448,
                nullCount: 3000,
                distinctEstimate: 8,
              },
              {
                column: 'Phase Of Fit',
                count: 73448,
                nullCount: 2500,
                distinctEstimate: 12,
              },
              {
                column: 'Height',
                count: 73448,
                nullCount: 10000,
                distinctEstimate: 500,
                min: 0,
                max: 25000,
                mean: 500,
              },
              {
                column: 'Speed',
                count: 73448,
                nullCount: 15000,
                distinctEstimate: 200,
                min: 0,
                max: 350,
                mean: 140,
              },
              {
                column: 'Cost Repairs',
                count: 73448,
                nullCount: 50000,
                distinctEstimate: 5000,
                min: 0,
                max: 5000000,
                mean: 25000,
              },
              {
                column: 'State',
                count: 73448,
                nullCount: 0,
                distinctEstimate: 52,
              },
              {
                column: 'Operator',
                count: 73448,
                nullCount: 1000,
                distinctEstimate: 500,
              },
              {
                column: 'Remarks',
                count: 73448,
                nullCount: 5000,
                distinctEstimate: 70000,
              },
            ];

            set((state) => {
              state.dataset = {
                id: 'faa-wildlife-strikes',
                name: 'FAA Wildlife Strikes',
                schema: mockSchema,
                statistics: mockStats,
                rowCount: 73448,
                source: 'local',
              };
              state.datasetLoading = false;
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load data';
            set((state) => {
              state.datasetError = message;
              state.datasetLoading = false;
            });
          }
        },

        clearDataset: () => {
          set((state) => {
            state.dataset = null;
            state.datasetError = null;
          });
        },

        // ====================================================================
        // Selection Actions
        // ====================================================================

        setBrush: (column, range) => {
          set((state) => {
            if (range) {
              state.selection.brushRanges.set(column, range);
            } else {
              state.selection.brushRanges.delete(column);
            }
            state.selection.filteredIndices = null;
          });
        },

        clearAllSelections: () => {
          set((state) => {
            state.selection.brushRanges.clear();
            state.selection.selectedCategories.clear();
            state.selection.selectedRows.clear();
            state.selection.filteredIndices = null;
          });
        },

        // ====================================================================
        // Layout Actions
        // ====================================================================

        setShelf: (shelf, columns) => {
          set((state) => {
            if (shelf === 'color' || shelf === 'size') {
              state.shelves[shelf] = columns[0] ?? null;
            } else {
              state.shelves[shelf] = columns;
            }
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },

        addToShelf: (shelf, column) => {
          set((state) => {
            if (shelf === 'color' || shelf === 'size') {
              state.shelves[shelf] = column;
            } else {
              if (!state.shelves[shelf].includes(column)) {
                state.shelves[shelf].push(column);
              }
            }
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },

        removeFromShelf: (shelf, column) => {
          set((state) => {
            if (shelf === 'color' || shelf === 'size') {
              if (state.shelves[shelf] === column) {
                state.shelves[shelf] = null;
              }
            } else {
              state.shelves[shelf] = state.shelves[shelf].filter((c) => c !== column);
            }
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },

        setChartType: (type, auto = false) => {
          set((state) => {
            state.chartType = type;
            state.chartTypeAuto = auto;
          });
        },

        toggleSidebar: () => {
          set((state) => {
            state.sidebarOpen = !state.sidebarOpen;
          });
        },

        // ====================================================================
        // CSV Data Loading - Uses Rayforce native read-csv via virtual FS
        // ====================================================================

        loadCSVData: async (file: File) => {
          const { bridge, status } = get();
          
          set((state) => {
            state.datasetLoading = true;
            state.datasetError = null;
          });

          try {
            const fileSizeMB = file.size / (1024 * 1024);
            console.log(`[Store] CSV file: ${file.name}, ${fileSizeMB.toFixed(1)}MB`);
            
            if (fileSizeMB > 500) {
              console.warn(`[Store] Large file (${fileSizeMB.toFixed(0)}MB) - this may take a while...`);
            }
            
            const text = await file.text();
            const lines = text.trim().split('\n');
            const headers = lines[0]?.split(',').map((h) => h.trim()) ?? [];
            const totalRows = lines.length - 1;
            
            console.log(`[Store] CSV: ${file.name}, ${totalRows.toLocaleString()} rows, ${headers.length} columns, ${(text.length / 1024 / 1024).toFixed(1)}MB`);
            console.log('[Store] Headers:', headers);
            
            // Infer types from first 100 rows
            const colTypes: Record<string, string> = {};
            headers.forEach((h) => { colTypes[h] = 'I64'; }); // Default to int
            
            for (let i = 1; i <= Math.min(100, lines.length - 1); i++) {
              const values = lines[i]?.split(',') ?? [];
              headers.forEach((h, idx) => {
                const val = values[idx]?.trim() ?? '';
                if (!val) return;
                
                // Check for GUID (UUID format)
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
                  colTypes[h] = 'GUID';
                }
                // Check for timestamp
                else if (/^\d{4}\.\d{2}\.\d{2}D/.test(val)) {
                  colTypes[h] = 'TIMESTAMP';
                }
                // Check for date
                else if (/^\d{4}[-./]\d{2}[-./]\d{2}$/.test(val)) {
                  colTypes[h] = 'DATE';
                }
                // Check for float
                else if (/^-?\d+\.\d+$/.test(val)) {
                  colTypes[h] = 'F64';
                }
                // Check for int
                else if (/^-?\d+$/.test(val)) {
                  // Keep as I64
                }
                // Otherwise symbol
                else if (isNaN(Number(val))) {
                  colTypes[h] = 'SYMBOL';
                }
              });
            }
            
            // Build schema for UI
            const schema: ColumnSchema[] = headers.map((name) => ({
              name: name.replace(/[^a-zA-Z0-9_]/g, '_'),
              type: (colTypes[name]?.toLowerCase() ?? 'symbol') as RayforceType,
              nullable: true,
            }));

            const tableName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
            let loadedIntoRayforce = false;
            let rowsLoaded = totalRows;
            
            if (bridge && status === 'ready') {
              try {
                // Write CSV to Rayforce virtual filesystem via worker
                // Sanitize filename for path
                const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const csvPath = `/tmp/${safeFileName}`;
                console.log('[Store] Writing CSV to virtual FS:', csvPath, 'size:', text.length, 'bytes');
                
                // Write file to Emscripten FS
                const writeResult = await bridge.writeFile(csvPath, text);
                console.log('[Store] File written:', writeResult);
                
                // Build type list for read-csv: [GUID SYMBOL I64 I64 I64 TIMESTAMP]
                const typeList = headers.map((h) => colTypes[h] ?? 'SYMBOL').join(' ');
                console.log('[Store] Detected types:', Object.entries(colTypes).map(([k,v]) => `${k}:${v}`).join(', '));
                
                // Use native read-csv
                const readExpr = `(set ${tableName} (read-csv [${typeList}] "${csvPath}"))`;
                console.log('[Store] Rayfall read-csv expression:', readExpr);
                
                const result = await bridge.eval(readExpr);
                console.log('[Store] read-csv result:', String(result).substring(0, 300));
                
                // Check if it worked by getting count
                const countResult = await bridge.eval(`(count ${tableName})`);
                const countStr = String(countResult).replace(/[^0-9]/g, '');
                console.log('[Store] Table row count:', countResult, '-> parsed:', countStr);
                
                if (countResult && !String(countResult).toLowerCase().includes('error')) {
                  const count = parseInt(countStr, 10);
                  if (!isNaN(count) && count > 0) {
                    loadedIntoRayforce = true;
                    rowsLoaded = count;
                    console.log(`[Store] ✓ read-csv SUCCESS: ${count.toLocaleString()} rows loaded into Rayforce`);
                  } else {
                    console.warn('[Store] read-csv returned 0 or invalid count');
                    throw new Error('read-csv returned 0 rows');
                  }
                } else {
                  throw new Error(`read-csv failed: ${countResult}`);
                }
              } catch (err) {
                console.error('[Store] read-csv failed:', err);
                // Fallback: try building table manually with limited rows
                try {
                  await loadCSVManually(bridge, tableName, headers, colTypes, lines, 5000);
                  loadedIntoRayforce = true;
                  rowsLoaded = Math.min(5000, totalRows);
                } catch (manualErr) {
                  console.error('[Store] Manual load also failed:', manualErr);
                }
              }
            }

            set((state) => {
              state.dataset = {
                id: tableName,
                name: file.name,
                schema,
                statistics: [],
                rowCount: rowsLoaded,
                source: 'local',
              };
              state.datasetLoading = false;
            });
            
            console.log(`[Store] Dataset "${tableName}" ready: ${rowsLoaded} rows, Rayforce: ${loadedIntoRayforce}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load CSV';
            console.error('[Store] CSV load error:', err);
            set((state) => {
              state.datasetError = message;
              state.datasetLoading = false;
            });
          }
        },

        // ====================================================================
        // Visualization Encoding Actions
        // ====================================================================

        addColumnToRows: (column) => {
          set((state) => {
            if (!state.shelves.rows.includes(column)) {
              state.shelves.rows.push(column);
            }
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },

        addColumnToColumns: (column) => {
          set((state) => {
            if (!state.shelves.columns.includes(column)) {
              state.shelves.columns.push(column);
            }
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },

        addColumnToValues: (column, _aggregation = 'sum') => {
          set((state) => {
            if (!state.shelves.columns.includes(column)) {
              state.shelves.columns.push(column);
            }
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },

        removeColumnFromRows: (index) => {
          set((state) => {
            state.shelves.rows.splice(index, 1);
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },

        removeColumnFromColumns: (index) => {
          set((state) => {
            state.shelves.columns.splice(index, 1);
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },

        removeColumnFromValues: (index) => {
          set((state) => {
            state.shelves.columns.splice(index, 1);
            if (state.chartTypeAuto) {
              state.chartType = suggestChartType(state.shelves);
            }
          });
        },
      }))
    ),
    {
      name: 'RayLens',
      enabled: import.meta.env.DEV,
    }
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

function suggestChartType(shelves: ShelfConfiguration): ChartType {
  const { rows, columns } = shelves;

  if (rows.length === 0 && columns.length === 0) {
    return 'table';
  }

  if (columns.length === 1 && rows.length === 1) {
    return 'scatter';
  }

  if (columns.length === 1 && rows.length === 0) {
    return 'histogram';
  }

  if (rows.length >= 1 && columns.length === 0) {
    return 'bar';
  }

  return 'table';
}

// Alias for backward compatibility
export const useRayforceStore = useRayLensStore;

// Re-export types
export type {
  ColumnSchema,
  ColumnStatistics,
  ColumnarResult,
  QueryPlan,
  Selection,
  ShelfConfiguration,
  ChartType,
};
