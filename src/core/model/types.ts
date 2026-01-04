/**
 * Core domain types for RayLens
 */

// ============================================================================
// Rayforce Type System
// ============================================================================

export type RayforceType =
  | 'b8'        // Boolean
  | 'u8'        // Unsigned byte
  | 'i16'       // 16-bit integer
  | 'i32'       // 32-bit integer
  | 'i64'       // 64-bit integer
  | 'f64'       // 64-bit float
  | 'symbol'    // Interned string
  | 'date'      // Days since 2000-01-01
  | 'time'      // Milliseconds since midnight
  | 'timestamp' // Nanoseconds since 2000-01-01
  | 'guid'      // UUID
  | 'c8'        // Character/String
  | 'list'      // Mixed-type list
  | 'dict'      // Dictionary
  | 'table';    // Table

export type TypedArrayType =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Int32Array
  | BigInt64Array
  | Float64Array;

// ============================================================================
// Schema Types
// ============================================================================

export interface ColumnSchema {
  name: string;
  type: RayforceType;
  nullable: boolean;
  metadata?: Record<string, unknown>;
}

export interface ColumnStatistics {
  column: string;
  count: number;
  nullCount: number;
  distinctEstimate: number;

  // Numeric columns
  min?: number | bigint;
  max?: number | bigint;
  mean?: number;
  stddev?: number;

  // Temporal columns
  minDate?: Date;
  maxDate?: Date;

  // Histogram buckets (for distribution preview)
  histogram?: { bucket: number; count: number }[];
}

// ============================================================================
// Query Types
// ============================================================================

export interface QueryPlan {
  source: string;              // Table name
  projections: Projection[];
  filters: Filter[];
  groupings: Grouping[];
  orderings: Ordering[];
  limit: number;
  offset: number;
}

export interface Projection {
  expression: string;          // Rayforce expression
  alias: string;               // Output column name
  aggregation?: AggregationType;
}

export type AggregationType =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'first'
  | 'last'
  | 'distinct';

export interface Filter {
  id: string;
  column: string;
  operator: FilterOperator;
  value: FilterValue;
  enabled: boolean;
}

export type FilterOperator =
  | 'eq'       // =
  | 'ne'       // <>
  | 'lt'       // <
  | 'le'       // <=
  | 'gt'       // >
  | 'ge'       // >=
  | 'in'       // in set
  | 'not_in'   // not in set
  | 'between'  // range
  | 'like'     // pattern match
  | 'not_like' // not pattern match
  | 'is_null'
  | 'is_not_null';

export type FilterValue =
  | number
  | bigint
  | string
  | boolean
  | Date
  | number[]
  | string[]
  | [number, number];  // range

export interface Grouping {
  column: string;
}

export interface Ordering {
  column: string;
  direction: 'asc' | 'desc';
}

// ============================================================================
// Result Types
// ============================================================================

export interface ColumnarResult {
  columns: Map<string, ColumnData>;
  rowCount: number;
  schema: ColumnSchema[];
  metadata: ResultMetadata;
}

export interface ColumnData {
  type: RayforceType;
  data: TypedArrayType | string[];
}

export interface ResultMetadata {
  queryTime: number;
  fromCache: boolean;
  isComplete: boolean;
  totalRows?: number;  // For paginated results
}

// ============================================================================
// Selection Types
// ============================================================================

export interface Selection {
  // Numeric range brushes
  brushRanges: Map<string, { min: number; max: number }>;

  // Category selections
  selectedCategories: Map<string, Set<string>>;

  // Direct row selection
  selectedRows: Set<number>;

  // Computed filtered indices
  filteredIndices: Uint32Array | null;
}

// ============================================================================
// Layout Types
// ============================================================================

export interface ShelfConfiguration {
  rows: string[];       // Columns on row shelf
  columns: string[];    // Columns on column shelf
  filters: string[];    // Columns on filter shelf
  color: string | null; // Column for color encoding
  size: string | null;  // Column for size encoding
}

export type ChartType =
  | 'table'
  | 'line'
  | 'bar'
  | 'scatter'
  | 'histogram'
  | 'heatmap'
  | 'area'
  | 'pie';

export interface DashboardPanel {
  id: string;
  type: 'chart' | 'table' | 'filter' | 'text';
  title: string;
  config: PanelConfig;
  layout: PanelLayout;
}

export interface PanelConfig {
  chartType?: ChartType;
  shelves?: ShelfConfiguration;
  filters?: Filter[];
  markdown?: string;
}

export interface PanelLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

// ============================================================================
// Workbook Types
// ============================================================================

export interface Workbook {
  version: 1;
  name: string;
  created: string;
  modified: string;
  datasets: DatasetDefinition[];
  dashboard: {
    panels: DashboardPanel[];
    globalFilters: Filter[];
  };
  views: SavedView[];
  settings: WorkbookSettings;
}

export interface DatasetDefinition {
  id: string;
  name: string;
  source: DataSource;
  schema: ColumnSchema[];
  statistics: ColumnStatistics[];
}

export type DataSource =
  | { type: 'remote'; connection: string; query: string }
  | { type: 'file'; path: string; format: 'csv' | 'parquet' }
  | { type: 'sample'; name: string };

export interface SavedView {
  id: string;
  name: string;
  queryPlan: QueryPlan;
  shelves: ShelfConfiguration;
  chartType: ChartType;
}

export interface WorkbookSettings {
  theme: 'light' | 'dark' | 'system';
  defaultLimit: number;
  autoRefresh: boolean;
  refreshInterval: number;
}

// ============================================================================
// Worker Message Types
// ============================================================================

export type WorkerRequest =
  | { type: 'init' }
  | { type: 'eval'; id: string; expression: string }
  | { type: 'load_data'; id: string; data: ArrayBuffer; format: 'rayforce' | 'csv' }
  | { type: 'write_file'; id: string; path: string; content: string }
  | { type: 'query'; id: string; plan: QueryPlan }
  | { type: 'cancel'; id: string };

export type WorkerResponse =
  | { type: 'ready'; version: string }
  | { type: 'result'; id: string; data: unknown }
  | { type: 'columns'; id: string; columns: TransferableColumns }
  | { type: 'progress'; id: string; progress: number }
  | { type: 'error'; id: string; message: string };

export interface TransferableColumns {
  buffers: ArrayBuffer[];
  descriptors: ColumnDescriptor[];
}

export interface ColumnDescriptor {
  name: string;
  type: RayforceType;
  offset: number;
  length: number;
  bufferIndex: number;
}
