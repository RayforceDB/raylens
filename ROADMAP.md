# RayLens Implementation Roadmap

> Phased implementation plan with clear milestones and deliverables

---

## Phase 0: Foundation (Week 1-2)

**Goal**: Establish the UI ↔ WASM compute loop without complex UI.

### Deliverables

1. **Project Scaffolding**
   - Vite + React + TypeScript setup
   - Tailwind CSS configuration
   - ESLint + Prettier configuration
   - Basic folder structure

2. **WASM Integration**
   - Copy rayforce-wasm SDK to `public/rayforce/`
   - Create Worker wrapper (`workers/rayforce.worker.ts`)
   - Implement main↔worker message bridge
   - Verify zero-copy TypedArray transfer

3. **Proof of Concept UI**
   - Single page with "Load Sample Data" button
   - Display raw WASM eval results
   - Show basic table metadata (schema, row count)

### Technical Tasks

```typescript
// Task 0.1: Worker bridge implementation
interface WorkerBridge {
  init(): Promise<{ version: string }>;
  eval(expression: string): Promise<RayObject>;
  loadTable(data: ArrayBuffer): Promise<TableMetadata>;
  getColumn(name: string): Promise<TypedArray>;
}

// Task 0.2: Verify zero-copy works
const worker = new Worker('./rayforce.worker.ts');
const result = await bridge.eval('(til 1000000)');
// Verify: result.buffer instanceof SharedArrayBuffer
// Verify: No data copying in transfer
```

### Acceptance Criteria

- [ ] `npm run dev` starts the app
- [ ] Rayforce WASM initializes in Worker
- [ ] Can evaluate `(+ 1 2 3)` and see result `6`
- [ ] Can load a 1M row table and access columns without blocking UI
- [ ] TypedArray views work correctly (BigInt64Array, Float64Array, etc.)

### Files to Create

```
src/core/rayforce/
├── worker.ts           # Worker entry point
├── bridge.ts           # Main thread API
├── messages.ts         # Message type definitions
└── index.ts            # Public exports

workers/
└── rayforce.worker.ts  # Worker implementation
```

---

## Phase 1: Data Contract (Week 3-4)

**Goal**: Lock down QueryPlan / Result / Selection types. Implement one minimal visual component.

### Deliverables

1. **Core Type System**
   - Complete `QueryPlan` type with all clauses
   - `ColumnarResult` with TypedArray columns
   - `Selection` with brush ranges and category sets
   - `ColumnSchema` with type information and statistics

2. **Zustand Store**
   - Dataset slice
   - Query slice
   - Selection slice
   - Action implementations

3. **Schema Explorer Component**
   - Column list with icons for types
   - Basic statistics display (min/max/distinct)
   - Click to add to query

### Type Definitions

```typescript
// src/core/model/schema.ts
interface ColumnSchema {
  name: string;
  type: RayforceType;
  nullable: boolean;
  metadata?: Record<string, unknown>;
}

interface ColumnStatistics {
  column: string;
  count: number;
  nullCount: number;
  distinctEstimate: number;
  // Numeric columns
  min?: number | bigint;
  max?: number | bigint;
  mean?: number;
  // Temporal columns
  minDate?: Date;
  maxDate?: Date;
}

// src/core/model/query.ts
interface QueryPlan {
  source: string;                    // Table name or subquery
  projections: Projection[];
  filters: Filter[];
  groupings: Grouping[];
  orderings: Ordering[];
  limit: number;
  offset: number;
}

interface Projection {
  expression: string;                // Rayforce expression
  alias: string;                     // Output column name
  aggregation?: AggregationType;     // sum, avg, min, max, count
}

interface Filter {
  id: string;                        // For removal
  column: string;
  operator: FilterOperator;
  value: FilterValue;
  enabled: boolean;
}

type FilterOperator =
  | 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'
  | 'in' | 'not_in'
  | 'between'
  | 'like' | 'not_like'
  | 'is_null' | 'is_not_null';

// src/core/model/result.ts
interface ColumnarResult {
  columns: Map<string, ColumnData>;
  rowCount: number;
  schema: ColumnSchema[];
  queryTime: number;
  fromCache: boolean;
}

type ColumnData =
  | { type: 'i64'; data: BigInt64Array }
  | { type: 'f64'; data: Float64Array }
  | { type: 'i32'; data: Int32Array }
  | { type: 'symbol'; data: string[] }  // Resolved symbols
  | { type: 'timestamp'; data: BigInt64Array }
  | { type: 'date'; data: Int32Array }
  | { type: 'bool'; data: Int8Array };

// src/core/model/selection.ts
interface Selection {
  // Numeric range brushes (crossfilter)
  brushRanges: Map<string, { min: number; max: number }>;

  // Category selections
  selectedCategories: Map<string, Set<string>>;

  // Computed filtered indices (for highlight)
  filteredIndices: Uint32Array | null;

  // Direct row selection (click/lasso)
  selectedRows: Set<number>;
}
```

### Acceptance Criteria

- [ ] All core types are defined and exported
- [ ] Zustand store compiles and runs
- [ ] Schema Explorer shows column list with types
- [ ] Clicking a column logs the column metadata
- [ ] Store actions update state correctly

---

## Phase 2: Table & Chart (Week 5-7)

**Goal**: Virtualized table + one chart, both backed by WASM results.

### Deliverables

1. **Virtual Table**
   - Row virtualization with TanStack Virtual
   - Column headers with sort controls
   - Cell renderers for each data type
   - Pagination controls

2. **Time Series Chart**
   - uPlot integration
   - Zoom/pan interaction
   - Brush selection for crossfilter

3. **Query Execution Pipeline**
   - QueryPlan → Rayforce expression compiler
   - Local WASM execution for cache hits
   - Result caching with LRU eviction

### Table Implementation

```typescript
// src/components/table/VirtualTable.tsx
interface VirtualTableProps {
  // Data
  result: ColumnarResult;

  // Virtualization
  overscan?: number;
  estimatedRowHeight?: number;

  // Interaction
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (rowIndex: number) => void;
  onCellClick?: (column: string, rowIndex: number) => void;

  // Selection highlight
  highlightedRows?: Set<number>;
}

// Key implementation detail: zero-copy cell access
function getCellValue(
  result: ColumnarResult,
  column: string,
  rowIndex: number
): CellValue {
  const col = result.columns.get(column);
  if (!col) return null;

  // Direct TypedArray access - no copying
  switch (col.type) {
    case 'i64':
      return col.data[rowIndex];
    case 'f64':
      return col.data[rowIndex];
    case 'symbol':
      return col.data[rowIndex];  // Pre-resolved strings
    // ... etc
  }
}
```

### Chart Implementation

```typescript
// src/components/chart/TimeSeriesChart.tsx
interface TimeSeriesChartProps {
  // Data (TypedArrays)
  timestamps: BigInt64Array;
  values: Float64Array;
  series?: string[];  // Multiple series names

  // Interaction
  onBrush?: (range: [number, number] | null) => void;

  // Appearance
  width: number;
  height: number;
}

// uPlot configuration
const uplotOptions: uPlot.Options = {
  width: props.width,
  height: props.height,
  cursor: {
    drag: { x: true, y: false },  // X-axis brushing
  },
  hooks: {
    setSelect: [
      (self) => {
        const min = self.posToVal(self.select.left, 'x');
        const max = self.posToVal(self.select.left + self.select.width, 'x');
        props.onBrush?.([min, max]);
      }
    ]
  }
};
```

### Acceptance Criteria

- [ ] Table renders 1M rows at 60fps scroll
- [ ] Sort by column header works
- [ ] Chart displays time-series data
- [ ] Chart brush updates selection state
- [ ] Table highlights rows matching selection

---

## Phase 3: Shelf System (Week 8-9)

**Goal**: Drag & drop shelves with automatic chart type selection.

### Deliverables

1. **Shelf UI**
   - Row shelf, Column shelf, Filter shelf
   - Color/Size drop zones
   - Column chips with type indicators

2. **Drag & Drop**
   - dnd-kit integration
   - Drop validation by column type
   - Reorder within shelf

3. **Auto Chart Selection**
   - Rules engine for shelf → chart type
   - Chart type manual override
   - Smooth chart type transitions

### Shelf Rules Engine

```typescript
// src/core/shelf/rules.ts
interface ShelfState {
  rows: ColumnSchema[];
  columns: ColumnSchema[];
  color: ColumnSchema | null;
  size: ColumnSchema | null;
}

function suggestChartType(shelves: ShelfState): ChartType {
  const { rows, columns, color } = shelves;

  // No data → placeholder
  if (rows.length === 0 && columns.length === 0) {
    return 'placeholder';
  }

  // Time on columns → time series
  if (columns.length === 1 && isTemporalType(columns[0].type)) {
    if (rows.length === 1 && isNumericType(rows[0].type)) {
      return 'line';
    }
  }

  // Category on columns, numeric on rows → bar
  if (columns.length === 1 && isCategoryType(columns[0].type)) {
    if (rows.length === 1 && isNumericType(rows[0].type)) {
      return 'bar';
    }
  }

  // Two numerics → scatter
  if (rows.length === 1 && columns.length === 1) {
    if (isNumericType(rows[0].type) && isNumericType(columns[0].type)) {
      return 'scatter';
    }
  }

  // Single numeric → histogram
  if (rows.length === 1 && columns.length === 0 && isNumericType(rows[0].type)) {
    return 'histogram';
  }

  // Fallback to table
  return 'table';
}
```

### Drag & Drop Implementation

```typescript
// src/components/shelves/ShelfContainer.tsx
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';

function ShelfContainer() {
  const { actions } = useStore();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const column = active.data.current as ColumnSchema;
    const targetShelf = over.id as ShelfType;

    // Validate drop
    if (!canDropOnShelf(column, targetShelf)) {
      return;  // Reject drop
    }

    actions.setShelf(targetShelf, column.name);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SchemaExplorer />  {/* Drag source */}
      <ShelfPanel />       {/* Drop targets */}
      <ChartArea />        {/* Reacts to shelf changes */}
    </DndContext>
  );
}
```

### Acceptance Criteria

- [ ] Can drag columns from schema explorer to shelves
- [ ] Invalid drops are rejected with visual feedback
- [ ] Chart type updates automatically based on shelf config
- [ ] Can manually override chart type
- [ ] Can remove columns from shelves
- [ ] Can reorder columns within a shelf

---

## Phase 4: Rayfall Integration (Week 10-12)

**Goal**: Connect to remote Rayforce nodes via WebSocket with streaming and cancellation.

### Deliverables

1. **WebSocket Transport**
   - Rayfall message encoding/decoding
   - Binary protocol over WebSocket
   - Reconnection with exponential backoff

2. **Session Management**
   - Handshake implementation
   - Authentication flow
   - Session keepalive

3. **Streaming Results**
   - Chunked result handling
   - Progress reporting
   - Backpressure management

4. **Query Cancellation**
   - Cancel in-flight queries
   - Cleanup partial results

### Protocol Implementation

```typescript
// src/core/rayfall/protocol.ts
const RAYFALL_MAGIC = 0xcefadefa;

interface RayfallHeader {
  magic: number;      // 4 bytes
  version: number;    // 1 byte
  flags: number;      // 1 byte
  endian: number;     // 1 byte
  msgType: number;    // 1 byte
  size: bigint;       // 8 bytes
}

function encodeHeader(header: RayfallHeader): Uint8Array {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);

  view.setUint32(0, header.magic, true);
  view.setUint8(4, header.version);
  view.setUint8(5, header.flags);
  view.setUint8(6, header.endian);
  view.setUint8(7, header.msgType);
  view.setBigUint64(8, header.size, true);

  return new Uint8Array(buffer);
}

function decodeHeader(data: Uint8Array): RayfallHeader {
  const view = new DataView(data.buffer, data.byteOffset, 16);

  return {
    magic: view.getUint32(0, true),
    version: view.getUint8(4),
    flags: view.getUint8(5),
    endian: view.getUint8(6),
    msgType: view.getUint8(7),
    size: view.getBigUint64(8, true)
  };
}
```

### Streaming Handler

```typescript
// src/core/rayfall/streaming.ts
class StreamingQueryHandler {
  private chunks: ColumnarChunk[] = [];
  private onChunk: (chunk: ColumnarChunk) => void;
  private onComplete: (result: ColumnarResult) => void;

  constructor(options: StreamingOptions) {
    this.onChunk = options.onChunk;
    this.onComplete = options.onComplete;
  }

  handleMessage(msg: RayfallMessage): void {
    if (msg.isChunk) {
      const chunk = deserializeChunk(msg.payload);
      this.chunks.push(chunk);
      this.onChunk(chunk);

      // Merge chunks for final result
      if (msg.isLastChunk) {
        const result = mergeChunks(this.chunks);
        this.onComplete(result);
      }
    }
  }
}

// Merge strategy: concatenate TypedArrays
function mergeChunks(chunks: ColumnarChunk[]): ColumnarResult {
  const columns = new Map<string, ColumnData>();

  // Calculate total length
  const totalRows = chunks.reduce((sum, c) => sum + c.rowCount, 0);

  // Allocate merged arrays
  for (const [name, firstCol] of chunks[0].columns) {
    const mergedData = allocateTypedArray(firstCol.type, totalRows);
    let offset = 0;

    for (const chunk of chunks) {
      const col = chunk.columns.get(name)!;
      mergedData.set(col.data, offset);
      offset += col.data.length;
    }

    columns.set(name, { type: firstCol.type, data: mergedData });
  }

  return { columns, rowCount: totalRows, schema: chunks[0].schema };
}
```

### Acceptance Criteria

- [ ] Can connect to remote Rayforce server
- [ ] Handshake completes successfully
- [ ] Sync queries return results
- [ ] Streaming queries show progressive results
- [ ] Cancel button stops in-flight queries
- [ ] Reconnects after network failure

---

## Phase 5: Dashboard (Week 13-15)

**Goal**: Dashboard canvas with panel layout and project persistence.

### Deliverables

1. **Dashboard Canvas**
   - react-grid-layout integration
   - Resizable/draggable panels
   - Panel add/remove

2. **Panel Types**
   - Chart panel
   - Table panel
   - Filter panel
   - Text/markdown panel

3. **Project Persistence**
   - Workbook format (JSON)
   - Save to IndexedDB
   - Export/import files
   - Autosave

### Dashboard Layout

```typescript
// src/components/dashboard/DashboardCanvas.tsx
import GridLayout from 'react-grid-layout';

interface DashboardPanel {
  id: string;
  type: 'chart' | 'table' | 'filter' | 'text';
  config: PanelConfig;
  layout: { x: number; y: number; w: number; h: number };
}

function DashboardCanvas() {
  const { dashboard, actions } = useStore();

  const layout = dashboard.panels.map(panel => ({
    i: panel.id,
    x: panel.layout.x,
    y: panel.layout.y,
    w: panel.layout.w,
    h: panel.layout.h,
    minW: 2,
    minH: 2
  }));

  return (
    <GridLayout
      className="dashboard-grid"
      layout={layout}
      cols={12}
      rowHeight={60}
      onLayoutChange={(newLayout) => {
        actions.updateDashboardLayout(newLayout);
      }}
    >
      {dashboard.panels.map(panel => (
        <div key={panel.id} className="dashboard-panel">
          <PanelToolbar panel={panel} />
          <PanelContent panel={panel} />
        </div>
      ))}
    </GridLayout>
  );
}
```

### Workbook Format

```typescript
// src/core/workbook/format.ts
interface Workbook {
  version: 1;
  name: string;
  created: string;
  modified: string;

  // Data sources
  datasets: DatasetDefinition[];

  // Dashboard layout
  dashboard: {
    panels: DashboardPanel[];
    globalFilters: Filter[];
  };

  // Saved views
  views: SavedView[];

  // User settings
  settings: WorkbookSettings;
}

interface DatasetDefinition {
  id: string;
  name: string;
  source:
    | { type: 'remote'; connection: string; query: string }
    | { type: 'file'; path: string; format: 'csv' | 'parquet' }
    | { type: 'sample'; name: string };
  schema: ColumnSchema[];
  cachedStatistics: ColumnStatistics[];
}
```

### Acceptance Criteria

- [ ] Can add/remove panels on dashboard
- [ ] Panels can be resized and moved
- [ ] Panel layout persists on refresh
- [ ] Can save workbook to file
- [ ] Can load workbook from file
- [ ] Autosave works

---

## Phase 6: Polish & Performance (Week 16-18)

**Goal**: Optimize performance, add UX polish, and prepare for production.

### Performance Optimizations

1. **Query Cancellation UX**
   - Cancel button appears during queries
   - Keyboard shortcut (Escape)
   - Visual feedback on cancel

2. **Prefetching**
   - Prefetch adjacent pages for table scroll
   - Prefetch common aggregations
   - Background cache warming

3. **Cache Management**
   - LRU eviction policy
   - Cache size configuration
   - Cache hit/miss metrics

4. **Render Optimizations**
   - OffscreenCanvas for charts
   - requestIdleCallback for prefetch
   - React.memo for expensive components

### UX Polish

1. **Loading States**
   - Skeleton loaders
   - Progress indicators
   - Streaming result updates

2. **Error Handling**
   - User-friendly error messages
   - Retry suggestions
   - Error boundaries

3. **Keyboard Navigation**
   - Table cell navigation
   - Shelf keyboard shortcuts
   - Focus management

4. **Accessibility**
   - ARIA labels
   - Screen reader support
   - High contrast mode

### Performance Targets

```typescript
// src/utils/performance.ts
const PERFORMANCE_BUDGETS = {
  // Initial load
  ttfcp: 1500,           // Time to First Contentful Paint (ms)
  tti: 3000,             // Time to Interactive (ms)

  // Interactions
  filterApply: 16,       // Single frame
  tableScroll: 16,       // 60fps
  chartBrush: 16,        // 60fps
  shelfDrop: 100,        // Acceptable delay

  // Queries
  localQuery: 50,        // Local WASM
  remoteP50: 500,        // Remote query
  remoteP95: 2000,

  // Memory
  baselineHeap: 100,     // MB
  maxHeap: 500           // MB
};

// Performance monitoring
function measureInteraction(name: string, fn: () => void) {
  const start = performance.now();
  fn();
  const duration = performance.now() - start;

  if (duration > PERFORMANCE_BUDGETS[name]) {
    console.warn(`Performance budget exceeded: ${name} took ${duration}ms`);
  }
}
```

### Acceptance Criteria

- [ ] Initial load < 2s on fast 3G
- [ ] Table scrolls at 60fps with 1M rows
- [ ] No janks during chart brush
- [ ] Memory stays under 500MB
- [ ] All major interactions have loading states
- [ ] Errors show user-friendly messages
- [ ] Basic keyboard navigation works

---

## Timeline Summary

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Phase 0 | 2 weeks | WASM compute loop working |
| Phase 1 | 2 weeks | Data contracts locked, schema explorer |
| Phase 2 | 3 weeks | Virtual table + time series chart |
| Phase 3 | 2 weeks | Shelf drag & drop + auto chart selection |
| Phase 4 | 3 weeks | Rayfall streaming + cancellation |
| Phase 5 | 3 weeks | Dashboard + persistence |
| Phase 6 | 3 weeks | Performance + polish |
| **Total** | **18 weeks** | **Production-ready MVP** |

---

## Success Metrics

### Phase Completion Gates

Each phase must pass these checks before advancing:

1. **Functional**: All acceptance criteria met
2. **Performance**: No regressions from budgets
3. **Quality**: No critical bugs, lint clean
4. **Documentation**: API docs updated

### Launch Readiness Checklist

- [ ] All 6 phases complete
- [ ] Performance budgets met
- [ ] Accessibility audit passed
- [ ] Security review completed
- [ ] Documentation complete
- [ ] Example workbooks created
- [ ] Error monitoring in place

