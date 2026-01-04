# RayLens Architecture

> Browser-first, timestored pulse analytical application built on RayforceDB

## Executive Summary

RayLens is a high-performance analytical application that runs entirely in the browser, leveraging WebAssembly to embed RayforceDB for local computation while connecting to remote Rayforce nodes for heavy queries. The architecture prioritizes responsiveness through local WASM execution while maintaining compatibility with future desktop/Tauri deployment.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Browser Environment                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         Main Thread                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
│  │  │   React    │  │   Zustand  │  │  Rayfall   │  │   Worker   │  │   │
│  │  │    UI      │  │   Store    │  │  Protocol  │  │   Bridge   │  │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  │   │
│  │        │               │               │               │          │   │
│  │        └───────────────┴───────────────┴───────────────┘          │   │
│  │                        Central Model                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│              ┌────────────────────┼────────────────────┐                │
│              │ postMessage        │                    │                │
│              ▼                    ▼                    ▼                │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐          │
│  │  Query Worker  │   │  Cache Worker  │   │ Render Worker  │          │
│  │  ┌──────────┐  │   │  ┌──────────┐  │   │  ┌──────────┐  │          │
│  │  │ Rayforce │  │   │  │ Rayforce │  │   │  │  Canvas  │  │          │
│  │  │   WASM   │  │   │  │   WASM   │  │   │  │ Renderer │  │          │
│  │  └──────────┘  │   │  └──────────┘  │   │  └──────────┘  │          │
│  └────────────────┘   └────────────────┘   └────────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket (Rayfall Protocol)
                                    ▼
                    ┌─────────────────────────────┐
                    │     Remote Rayforce Nodes    │
                    │   (Heavy scans, group-bys)   │
                    └─────────────────────────────┘
```

---

## Layer Breakdown

### Layer 1: Central Data Model (Zustand Store)

The single source of truth for all UI components. This is the **mandatory central model** that unifies all interactions.

```typescript
// Core model structure
interface RayLensStore {
  // Dataset metadata
  dataset: {
    id: string;
    schema: ColumnSchema[];
    statistics: ColumnStatistics[];
    rowCount: number;
    source: 'local' | 'remote';
  } | null;

  // Query specification (what the user wants)
  queryPlan: {
    projections: Projection[];      // columns to show
    filters: Filter[];               // WHERE conditions
    groupings: Grouping[];           // GROUP BY columns
    sorts: Sort[];                   // ORDER BY
    limit: number;                   // viewport page size
    offset: number;                  // pagination offset
  };

  // Query execution state
  queryState: {
    status: 'idle' | 'local_pending' | 'remote_pending' | 'streaming' | 'complete' | 'error';
    localResult: ColumnarResult | null;    // fast preview from WASM
    remoteResult: ColumnarResult | null;   // authoritative from server
    streamProgress: number;                 // 0-1 for streaming queries
    cancelToken: string | null;
  };

  // Selection state (crossfilter)
  selection: {
    brushRanges: Map<string, [number, number]>;  // column -> numeric range
    selectedCategories: Map<string, Set<string>>; // column -> category set
    selectedIndices: Uint32Array | null;          // row indices
  };

  // UI layout state
  layout: {
    shelves: {
      rows: string[];      // columns on row shelf
      columns: string[];   // columns on column shelf
      filters: string[];   // columns on filter shelf
      color: string | null;
      size: string | null;
    };
    chartType: ChartType;
    dashboardPanels: PanelLayout[];
  };

  // Actions
  actions: {
    setFilter: (column: string, predicate: FilterPredicate) => void;
    removeFilter: (column: string) => void;
    setShelf: (shelf: ShelfType, columns: string[]) => void;
    setSort: (column: string, direction: 'asc' | 'desc') => void;
    setBrush: (column: string, range: [number, number] | null) => void;
    selectCategories: (column: string, values: Set<string>) => void;
    cancelQuery: () => void;
    loadDataset: (source: DataSource) => Promise<void>;
  };
}

// Columnar result format (TypedArrays, not JSON)
interface ColumnarResult {
  columns: Map<string, TypedArray | string[]>;
  rowCount: number;
  schema: ColumnSchema[];
  metadata: {
    isComplete: boolean;
    queryTime: number;
    cacheHit: boolean;
  };
}
```

### Layer 2: WASM Compute Engine

RayforceDB runs in Web Workers for non-blocking computation.

```typescript
// Worker message protocol
type WorkerRequest =
  | { type: 'init'; wasmPath: string }
  | { type: 'load_data'; data: ArrayBuffer; format: 'rayforce' | 'arrow' | 'csv' }
  | { type: 'query'; plan: QueryPlan; requestId: string }
  | { type: 'filter'; column: string; predicate: FilterPredicate }
  | { type: 'aggregate'; columns: string[]; aggregations: Aggregation[] }
  | { type: 'cancel'; requestId: string };

type WorkerResponse =
  | { type: 'ready'; version: string }
  | { type: 'schema'; schema: ColumnSchema[]; statistics: ColumnStatistics[] }
  | { type: 'result'; requestId: string; columns: TransferableColumns }
  | { type: 'progress'; requestId: string; progress: number }
  | { type: 'error'; requestId: string; message: string };

// Zero-copy data transfer
interface TransferableColumns {
  // SharedArrayBuffer or transferable ArrayBuffer
  buffers: ArrayBuffer[];
  // Metadata for reconstructing TypedArray views
  descriptors: ColumnDescriptor[];
}
```

### Layer 3: Rayfall Protocol Bridge

WebSocket adapter that preserves the Rayfall binary protocol semantics.

```typescript
interface RayfallConnection {
  // Connection lifecycle
  connect(url: string, credentials?: Credentials): Promise<void>;
  disconnect(): void;

  // Sync queries (request-response)
  query(expression: string): Promise<ColumnarResult>;

  // Streaming queries
  streamQuery(expression: string): AsyncIterable<ColumnarChunk>;

  // Async messages (fire-and-forget)
  sendAsync(expression: string): void;

  // Cancellation
  cancel(queryId: string): void;

  // Backpressure
  readonly pendingBytes: number;
  readonly highWaterMark: number;
}

// Protocol message types (from IPC docs)
enum MessageType {
  SYNC = 0,       // Request with expected response
  RESPONSE = 1,   // Response to sync request
  ASYNC = 2       // Fire-and-forget
}

// Wire format (16-byte header + serialized payload)
interface RayfallMessage {
  prefix: 0xcefadefa;    // Magic number
  version: number;        // Protocol version
  flags: number;          // Message flags
  endian: number;         // 0=little, 1=big
  msgType: MessageType;
  size: bigint;           // 8-byte size
  payload: Uint8Array;    // Serialized Rayforce object
}
```

---

## Data Flow Patterns

### Pattern 1: Immediate Local Feedback

```
User Action → QueryPlan mutation → WASM Worker (local cache) → UI Update (< 16ms)
                                 ↓
                            Remote Query (parallel) → Stream chunks → Cache update → UI Update
```

### Pattern 2: Viewport Virtualization

```
Table scroll → Request visible rows [offset, offset+limit]
            → Check local WASM cache
            → If miss: fetch from remote with prefetch buffer
            → Render only visible rows
```

### Pattern 3: Crossfilter Brushing

```
Brush on Chart A → Selection.brushRanges update
                 → Local WASM: compute filtered indices
                 → All charts re-render with filtered data (< 16ms)
                 → Optionally: remote query for filtered aggregates
```

---

## Memory Architecture

### WASM Heap Management

```typescript
// SharedArrayBuffer for zero-copy between workers
interface SharedColumnStore {
  // Pre-allocated shared memory region
  sharedBuffer: SharedArrayBuffer;

  // Allocator for columnar data
  allocate(bytes: number): { offset: number; view: ArrayBuffer };

  // Column registry
  columns: Map<string, {
    offset: number;
    length: number;
    type: RayforceType;
  }>;

  // LRU eviction for cache management
  evict(bytesToFree: number): void;
}
```

### Memory Budget Strategy

| Budget | Allocation |
|--------|------------|
| 256MB | WASM heap (Rayforce engine) |
| 128MB | Column cache (hot data) |
| 64MB | Query result buffer |
| 32MB | UI component state |
| **480MB** | **Total target** |

---

## Component Architecture

### Table Component

```typescript
// Using TanStack Virtual for row virtualization
interface VirtualizedTable {
  // Data binding
  columns: ColumnDescriptor[];
  getRow: (index: number) => TypedRow;  // Zero-copy accessor
  rowCount: number;

  // Virtualization
  overscan: number;           // Pre-render buffer
  estimateRowHeight: number;  // For variable heights

  // Interaction
  onSort: (column: string, direction: SortDirection) => void;
  onFilter: (column: string, predicate: FilterPredicate) => void;
  onSelect: (indices: number[]) => void;

  // Rendering
  renderCell: (column: string, value: any, rowIndex: number) => ReactNode;
}
```

### Chart Components

```typescript
// Canvas/WebGL rendering, not SVG
interface ChartSpec {
  type: 'line' | 'bar' | 'scatter' | 'histogram' | 'heatmap';

  // Data binding (TypedArrays)
  x: Float64Array | BigInt64Array;
  y: Float64Array | BigInt64Array;
  color?: Float64Array | string[];
  size?: Float64Array;

  // Selection integration
  brushable: boolean;
  onBrush: (range: [number, number] | null) => void;

  // Renderer
  renderer: 'uplot' | 'echarts' | 'custom-canvas';
}
```

### Shelf System (Drag & Drop)

```typescript
// Using dnd-kit for drag operations
interface ShelfSystem {
  shelves: {
    rows: ColumnChip[];
    columns: ColumnChip[];
    filters: ColumnChip[];
    color: ColumnChip | null;
    size: ColumnChip | null;
  };

  // Schema-aware drop validation
  canDrop: (column: ColumnSchema, shelf: ShelfType) => boolean;

  // Auto-suggest chart type based on shelf configuration
  suggestChartType: (shelves: ShelfConfiguration) => ChartType;
}
```

---

## File & Project Structure

```
raylens/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── index.html
│
├── public/
│   └── rayforce/
│       ├── rayforce.wasm
│       ├── rayforce.js
│       └── rayforce.sdk.js
│
├── src/
│   ├── main.tsx                      # Entry point
│   ├── App.tsx                       # Root component
│   │
│   ├── core/                         # Core business logic
│   │   ├── store/
│   │   │   ├── index.ts              # Zustand store
│   │   │   ├── slices/
│   │   │   │   ├── dataset.ts
│   │   │   │   ├── query.ts
│   │   │   │   ├── selection.ts
│   │   │   │   └── layout.ts
│   │   │   └── middleware/
│   │   │       ├── persist.ts        # Local persistence
│   │   │       └── undo.ts           # Undo/redo
│   │   │
│   │   ├── rayforce/                 # WASM integration
│   │   │   ├── worker.ts             # Worker entry
│   │   │   ├── bridge.ts             # Main↔Worker bridge
│   │   │   ├── types.ts              # TypedArray handling
│   │   │   └── cache.ts              # Local result cache
│   │   │
│   │   ├── rayfall/                  # Remote protocol
│   │   │   ├── connection.ts         # WebSocket client
│   │   │   ├── protocol.ts           # Message encoding/decoding
│   │   │   ├── serialization.ts      # Rayforce ser/de
│   │   │   └── streaming.ts          # Chunked result handling
│   │   │
│   │   └── model/                    # Domain types
│   │       ├── schema.ts
│   │       ├── query.ts
│   │       ├── result.ts
│   │       └── selection.ts
│   │
│   ├── components/                   # React components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Toolbar.tsx
│   │   │
│   │   ├── data/
│   │   │   ├── SchemaExplorer.tsx    # Column list with types
│   │   │   ├── DataPreview.tsx       # Quick data peek
│   │   │   └── StatisticsPanel.tsx   # Column stats
│   │   │
│   │   ├── table/
│   │   │   ├── VirtualTable.tsx      # Main table view
│   │   │   ├── TableHeader.tsx       # Sort/filter controls
│   │   │   ├── TableCell.tsx         # Cell renderers
│   │   │   └── TablePagination.tsx
│   │   │
│   │   ├── chart/
│   │   │   ├── ChartContainer.tsx    # Chart wrapper
│   │   │   ├── TimeSeriesChart.tsx   # uPlot-based
│   │   │   ├── BarChart.tsx          # ECharts-based
│   │   │   ├── ScatterPlot.tsx
│   │   │   └── Histogram.tsx
│   │   │
│   │   ├── shelves/
│   │   │   ├── ShelfContainer.tsx    # dnd-kit context
│   │   │   ├── Shelf.tsx             # Drop zone
│   │   │   ├── ColumnChip.tsx        # Draggable pill
│   │   │   └── FilterEditor.tsx      # Filter configuration
│   │   │
│   │   └── dashboard/
│   │       ├── DashboardCanvas.tsx   # react-grid-layout
│   │       ├── Panel.tsx             # Resizable panel
│   │       └── PanelToolbar.tsx
│   │
│   ├── hooks/                        # React hooks
│   │   ├── useQuery.ts               # Query execution
│   │   ├── useSelection.ts           # Crossfilter state
│   │   ├── useVirtualRows.ts         # Virtualization
│   │   └── useRayforce.ts            # WASM access
│   │
│   └── utils/
│       ├── format.ts                 # Value formatting
│       ├── color.ts                  # Color scales
│       └── performance.ts            # Timing utilities
│
├── workers/
│   ├── rayforce.worker.ts            # Query worker
│   └── render.worker.ts              # Offscreen canvas
│
└── tests/
    ├── core/
    ├── components/
    └── integration/
```

---

## Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Framework** | React 19 | Stable ecosystem, concurrent features |
| **Build** | Vite | Fast HMR, WASM support, ESM-native |
| **State** | Zustand | Minimal API, TypeScript-first, works with Workers |
| **Styling** | Tailwind + Radix UI | Utility-first, accessible primitives |
| **Table** | TanStack Virtual | Headless, row virtualization only |
| **Charts (time)** | uPlot | Fastest time-series, Canvas-based |
| **Charts (other)** | ECharts | Canvas/WebGL, rich chart types |
| **DnD** | dnd-kit | Headless, accessible, touch support |
| **Layout** | react-grid-layout | Proven dashboard layout |
| **WASM** | Emscripten + custom SDK | Matches existing rayforce-wasm |

---

## Platform Adaptation

### Browser (Primary)

```typescript
// No special adaptation needed
const platform = {
  storage: indexedDB,
  networking: WebSocket,
  compute: WebWorker + WASM,
  rendering: Canvas + WebGL
};
```

### Tauri (Future Desktop)

```typescript
const platform = {
  storage: tauri.fs,               // Native filesystem
  networking: tauri.http | TCP,    // Raw TCP for Rayfall
  compute: WebWorker + WASM,       // Same as browser
  rendering: Canvas + WebGL        // Same as browser
};
```

The core model and components remain unchanged. Only platform adapters differ.

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial load | < 2s | First contentful paint |
| WASM init | < 500ms | Worker ready message |
| Local filter | < 16ms | Frame budget |
| Table scroll | 60fps | No frame drops |
| Chart brush | < 16ms | Selection update |
| Remote query (P50) | < 500ms | First chunk arrival |
| Memory baseline | < 100MB | Cold start |

---

## Security Considerations

1. **WASM Isolation**: Rayforce WASM runs in Workers, isolated from DOM
2. **Origin Policy**: WebSocket connections respect CORS
3. **No eval()**: Query expressions are constructed, not interpolated
4. **Memory Safety**: TypedArray bounds checking enforced
5. **Credential Storage**: Rayfall auth tokens in memory only, not localStorage

