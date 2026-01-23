# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install           # Install dependencies
npm run dev           # Start development server (port 3000)
npm run build         # Build for production
npm run preview       # Preview production build
npm run typecheck     # Type check without emitting
npm run lint          # ESLint for TypeScript files
npm run test          # Run vitest tests
```

The project is a npm workspace with the main app at `apps/dashboard`.

## Architecture Overview

RayLens is a reactive dashboard builder for Rayforce databases. Users create dashboards with widgets (data grids, charts, text/KPI) bound to Rayfall queries that execute against a Rayforce server via WebSocket.

### Data Flow

```
Rayforce Server (ws://localhost:8765)
    ↓ WebSocket (IPC binary protocol)
RayforceClient (apps/dashboard/src/lib/rayforce.ts)
    ↓ Query results
Zustand Store (apps/dashboard/src/store/index.ts)
    ↓ React state
Widgets (DataGrid, Chart, Text)
```

### Key Directories

- `apps/dashboard/src/components/` - React components (Header, Sidebar, DashboardCanvas, widgets/)
- `apps/dashboard/src/lib/` - Rayforce WebSocket client, Monaco language definition, workspace utilities
- `apps/dashboard/src/store/` - Zustand state management with all actions
- `apps/dashboard/public/` - WASM bundle, SDK, demo workspaces

### Core Data Types

All defined in `apps/dashboard/src/store/index.ts`:
- **Workspace** - Contains dashboards, queries, server URL
- **Dashboard** - Contains widgets with grid positions
- **Query** - Rayfall code with cached results
- **Widget** - Type (grid/chart/text), binding to query, position, config

### App Modes

- **Dev Mode** - Full editing with sidebar, query editor, widget configuration
- **Live Mode** - Clean presentation view for dashboards

### Workspace Persistence

- Auto-saves to localStorage
- Export/import as `.lens.json` files
- URL sharing via base64-encoded hash (#/share/{encoded})

## Key Patterns

### State Management
Uses Zustand with shallow equality for selectors:
```typescript
const { queries } = useLensStore(state => ({ queries: state.workspace.queries }), shallow);
```

### Widget Binding
Widgets bind to queries via `binding.queryId` and support `refreshInterval` for auto-refresh.

### IPC Protocol
Binary protocol with 16-byte header (magic, version, flags, endian, type, payload size). See `lib/rayforce.ts` for serialization.

### Logging
Console output uses source prefix pattern: `console.log('[ComponentName] message')`.

## Rayfall Language Reference

Rayfall is a LISP-like, array-oriented query language for Rayforce databases.

### Syntax Basics

```clojure
; S-expressions - prefix notation
(+ 1 2)                      ; → 3
(* [1 2 3] 10)               ; → [10 20 30]

; Symbols (interned strings)
'AAPL  'symbol  'column_name

; Vectors (homogeneous)
[1 2 3]  ['a 'b 'c]  [2025.01.01 2025.01.02]

; Dictionaries
{name: "Alice" age: 30}

; Dates/Times/Timestamps
2025.01.15                   ; Date
09:30:00.000                 ; Time
2025.01.15D09:30:00.000      ; Timestamp (nanoseconds)
```

### Key Functions

```clojure
; Aggregations (operate on vectors)
(sum [1 2 3])     ; → 6
(avg [1 2 3])     ; → 2.0
(min [1 2 3])     ; → 1
(max [1 2 3])     ; → 3
(count [1 2 3])   ; → 3
(first [1 2 3])   ; → 1
(last [1 2 3])    ; → 3

; xbar - round down to nearest multiple (critical for time bucketing)
(xbar 17 5)                           ; → 15
(xbar timestamp 60000000000)          ; 1-minute buckets (nanoseconds)

; Element access
(at [1 2 3] 1)    ; → 2 (0-indexed)
(take [1 2 3] 2)  ; → [1 2]
```

### Select Queries

```clojure
; Basic select
(select {name: name salary: salary from: employees where: (> salary 50000)})

; Aggregation with grouping
(select {
  dept: dept
  avg_salary: (avg salary)
  headcount: (count name)
  from: employees
  by: dept
})

; OHLC candlestick aggregation (5-second candles)
(select {
  t: (first (eval (as 'symbol "timestamp")))
  open: (first price)
  high: (max price)
  low: (min price)
  close: (last price)
  from: trades
  by: (xbar (eval (as 'symbol "timestamp")) 5000000000)
})
```

### Data Types

| Type | Example | Notes |
|------|---------|-------|
| I64 | `42` | 64-bit integer |
| F64 | `3.14` | 64-bit float |
| Symbol | `'AAPL` | Interned string |
| Date | `2025.01.15` | Days since epoch |
| Time | `09:30:00` | Milliseconds since midnight |
| Timestamp | `2025.01.15D09:30:00` | Nanoseconds |
| Vector | `[1 2 3]` | Homogeneous array |
| Table | columns + rows | Columnar storage |

### Time Constants (nanoseconds)

- 1 second = `1000000000`
- 1 minute = `60000000000`
- 1 hour = `3600000000000`

## Requirements

- Node.js 20+
- Rayforce server for data connections
