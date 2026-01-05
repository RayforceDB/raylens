# RayLens Architecture

## Overview

RayLens is a dashboard builder for Rayforce databases. It provides a visual interface for creating analytics dashboards with live data binding.

## Core Concepts

### Workspace

A workspace contains:
- **Dashboards** - Multiple dashboard tabs
- **Queries** - Rayfall query definitions
- **Server URL** - Connection to Rayforce server

```typescript
interface Workspace {
  id: string;
  name: string;
  dashboards: Dashboard[];
  queries: Query[];
  serverUrl: string;
}
```

### Dashboard

A dashboard is a grid layout of widgets:

```typescript
interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
}
```

### Query

A query defines a Rayfall expression:

```typescript
interface Query {
  id: string;
  name: string;
  code: string;           // Rayfall code
  lastResult?: unknown;   // Cached result
  refreshInterval?: number;
}
```

### Widget

A widget is a visual component bound to a query:

```typescript
interface Widget {
  id: string;
  type: 'grid' | 'chart' | 'text';
  title: string;
  binding?: {
    queryId: string;
    refreshInterval: number;
    autoRun: boolean;
  };
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}
```

## Data Flow

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│  Rayforce   │────▶│  RayforceClient│────▶│    Store     │
│   Server    │     │  (WebSocket)  │     │   (Zustand)  │
└─────────────┘     └───────────────┘     └──────────────┘
                                                  │
                                                  ▼
                    ┌───────────────┐     ┌──────────────┐
                    │   Widgets     │◀────│   React      │
                    │ (AG Grid,     │     │  Components  │
                    │  ECharts)     │     │              │
                    └───────────────┘     └──────────────┘
```

## Components

### RayforceClient (`lib/rayforce.ts`)

Handles WebSocket connection and IPC protocol:

- Handshake with version negotiation
- Binary message serialization/deserialization
- Query execution (sync/async)
- Connection state management

### Store (`store/index.ts`)

Zustand store managing:

- Connection status
- Workspace state
- Query results
- UI state (selections, panels)
- App mode (dev/live)

### Widgets

- **DataGrid** - AG Grid with automatic column detection, pagination, column styling
- **Chart** - ECharts with multiple chart types
- **Text** - KPI display with number formatting

### Monaco Editor

Query editor with:
- Rayfall syntax highlighting
- Autocomplete with documentation
- Result preview pane
- Ctrl+Enter to execute

## IPC Protocol

Rayforce uses a binary IPC protocol:

### Handshake
```
[auth][version][null] → [version][null]
```

### Message Format
```
Header (16 bytes):
  - 4 bytes: magic (0xcefadefa)
  - 1 byte: version
  - 1 byte: flags
  - 1 byte: endian
  - 1 byte: message type
  - 8 bytes: payload size

Payload:
  - Serialized Rayforce object
```

### Serialization
```
Object format:
  - 1 byte: type
  - 1 byte: attributes
  - 8 bytes: length (for vectors)
  - N bytes: data
```

## State Management

Using Zustand for fine-grained reactivity:

```typescript
const useLensStore = create((set, get) => ({
  // State
  connectionStatus: 'disconnected',
  workspace: defaultWorkspace,
  appMode: 'dev',
  
  // Actions
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setQueryResult: (id, result) => set((state) => ({
    workspace: {
      ...state.workspace,
      queries: state.workspace.queries.map(q => 
        q.id === id ? { ...q, lastResult: result } : q
      )
    }
  })),
}));
```

## Workspace Persistence

Workspaces can be:

1. **Saved to localStorage** - Auto-save on changes
2. **Exported as JSON** - Download `.lens.json` file
3. **Imported from file** - Upload JSON workspace
4. **Shared via URL** - Base64 encoded in hash

## Refresh Intervals

Widgets support configurable refresh:

```typescript
useEffect(() => {
  if (!binding?.refreshInterval) return;
  
  const interval = setInterval(() => {
    executeQuery(binding.queryId);
  }, binding.refreshInterval);
  
  return () => clearInterval(interval);
}, [binding]);
```

## App Modes

### Dev Mode
- Full editing capabilities
- Sidebar with queries, widgets, settings
- Query editor and REPL
- Widget configuration controls
- Dashboard management

### Live Mode
- Clean presentation view
- No sidebar or bottom panel
- Minimal widget headers
- Immersive dark background
- Auto-refresh continues

## Future Enhancements

- [ ] Golden Layout for more flexible panel arrangements
- [ ] WASM Rayforce for client-side query execution
- [ ] Real-time streaming with delta updates
- [ ] User authentication & permissions
- [ ] Alert/notification system
- [ ] Query history & versioning
