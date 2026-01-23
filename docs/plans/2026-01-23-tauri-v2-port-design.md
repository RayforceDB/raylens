# RayLens Tauri v2 Port Design

## Overview

Port RayLens from WebSocket + WASM architecture to Tauri v2 with embedded native Rayforce.

**Goals:**
- Remove WASM and WebSocket entirely
- Embed native Rayforce library (no restrictions)
- Use Rayforce's built-in IPC/poll system for communication
- Minimize serialization overhead for real-time dashboard performance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri v2 Application                      │
├─────────────────────────────────────────────────────────────┤
│  React Frontend (apps/dashboard)                            │
│    └─ @tauri-apps/api invoke() calls                        │
├─────────────────────────────────────────────────────────────┤
│  Tauri Rust Backend (src-tauri/)                            │
│    ├─ Async Commands (execute_query, get_rows, release)     │
│    └─ Pipe to Rayforce poll loop                            │
├─────────────────────────────────────────────────────────────┤
│  Rayforce Poll Loop                                         │
│    ├─ Tauri selector (custom) ◄── commands via pipe         │
│    ├─ Handle store (HashMap<u64, obj_p>)                    │
│    └─ Response channel back to Tauri                        │
├─────────────────────────────────────────────────────────────┤
│  librayforce.a (embedded C library)                         │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Embedded Library (not sidecar)
Rayforce compiled as static library (`librayforce.a`) linked into Tauri binary. Single executable, in-process execution.

### 2. Poll-Integrated IPC
Instead of custom thread management, register a pipe/socket as a custom selector with Rayforce's extensible poll system:

```c
poll_registry_t registry = {
    .fd = pipe_rx,
    .type = SELECTOR_TYPE_SOCKET,
    .events = POLL_EVENT_READ,
    .data_fn = tauri_on_data,  // handles commands
    .data = ctx,
};
poll_register(runtime_get()->poll, &registry);
```

### 3. Row-Based Chunking
Only serialize visible rows for UI. Full results stay as `obj_p` in backend.

- `execute_query()` → returns metadata + handle (not full data)
- `get_rows(handle, start, count)` → uses Rayfall `take` to slice, serializes chunk
- AG Grid's virtual scrolling requests chunks as user scrolls

### 4. Handle Lifecycle
- `obj_p` results stored in HashMap by handle ID
- Explicit `release_handle()` calls `drop_obj()` on Rayforce thread
- Auto-release on query re-run (same query ID replaces previous)

### 5. Async & Cancellable
- All Tauri commands are async
- Frontend `await`s results, UI stays responsive
- `cancel_query()` marks in-flight queries as stale

## Rust FFI Bindings

```rust
#[link(name = "rayforce")]
extern "C" {
    // Lifecycle
    pub fn ray_init() -> i32;
    pub fn ray_clean();

    // Evaluation
    pub fn eval_str(code: *const c_char) -> ObjP;

    // Memory (must call on Rayforce thread!)
    pub fn drop_obj(obj: ObjP);

    // Table access
    pub fn at_idx(obj: ObjP, idx: i64) -> ObjP;
}
```

## Tauri Commands

```rust
#[tauri::command]
async fn execute_query(query_id: String, code: String) -> Result<QueryMeta, String>;

#[tauri::command]
async fn get_rows(handle: u64, start: u64, count: u64) -> Result<Vec<Row>, String>;

#[tauri::command]
async fn release_handle(handle: u64) -> Result<(), String>;

#[tauri::command]
async fn cancel_query(query_id: String) -> Result<(), String>;
```

## Frontend API

Simplified from ~1600 lines to ~80 lines:

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function execute(queryId: string, code: string): Promise<RayforceResult> {
  return invoke('execute_query', { queryId, code });
}

export async function getRows(handle: number, start: number, count: number): Promise<Row[]> {
  return invoke('get_rows', { handle, start, count });
}

export async function release(handle: number): Promise<void> {
  return invoke('release_handle', { handle });
}
```

## Project Structure

```
raylens/
├── apps/dashboard/           # React frontend (mostly unchanged)
│   └── src/lib/rayforce.ts   # Simplified: Tauri invoke() calls
│
├── src-tauri/                # NEW: Tauri backend
│   ├── Cargo.toml
│   ├── build.rs              # Compiles librayforce.a
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs           # App setup, spawn Rayforce
│       ├── commands.rs       # Tauri command handlers
│       ├── rayforce_ffi.rs   # C FFI bindings
│       └── bridge.rs         # Pipe/selector setup
│
├── rayforce/                 # Git submodule
└── package.json              # Updated scripts
```

## Build Process

**build.rs:**
1. `make lib` in rayforce/ → `librayforce.a`
2. Link static library
3. Link system libs (pthread, dl, m)
4. Run tauri_build

**Scripts:**
```json
{
  "dev": "tauri dev",
  "build": "tauri build"
}
```

## Removals

- `apps/dashboard/public/` WASM files
- WebSocket client code
- Binary IPC protocol parsing in JS
- Manual serialization/deserialization (~1500 lines)

## Migration Steps

1. Add `src-tauri/` with Tauri v2 scaffolding
2. Add rayforce as git submodule
3. Implement FFI bindings and build.rs
4. Implement bridge (pipe + selector registration)
5. Implement Tauri commands
6. Replace frontend `rayforce.ts`
7. Update widgets to use chunked row fetching
8. Remove WASM/WebSocket code
9. Test and iterate
