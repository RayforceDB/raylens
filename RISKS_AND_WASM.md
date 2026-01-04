# Technical Risks & WebAssembly Analysis

## Key Technical Risks

### Risk 1: WASM Memory Limits

**Risk Level**: 🟡 Medium

**Description**: Browser WASM has a default 256MB memory limit (can be increased to ~4GB on 64-bit systems). Large datasets may exceed available memory.

**Mitigation Strategies**:

1. **Streaming & Paging**
   - Never load full datasets into WASM
   - Work with viewport-sized chunks
   - Implement LRU cache eviction

2. **Memory Monitoring**
   ```typescript
   // Monitor WASM heap usage
   function getWASMMemoryUsage(): { used: number; limit: number } {
     const memory = wasmModule.HEAP8.buffer.byteLength;
     const used = wasmModule._get_heap_used?.() || memory * 0.8;
     return { used, limit: memory };
   }

   // Trigger eviction when approaching limit
   if (usage.used / usage.limit > 0.8) {
     cache.evictLRU(usage.limit * 0.2);
   }
   ```

3. **Graceful Degradation**
   - Fall back to server-side processing for oversized queries
   - Show warnings when approaching limits
   - Offer to reduce result set size

**Residual Risk**: Some power users may hit limits with complex multi-table operations.

---

### Risk 2: SharedArrayBuffer Availability

**Risk Level**: 🟡 Medium

**Description**: `SharedArrayBuffer` (required for true zero-copy between workers) requires specific HTTP headers due to Spectre mitigations.

**Required Headers**:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Mitigation Strategies**:

1. **Progressive Enhancement**
   ```typescript
   const supportsSharedMemory =
     typeof SharedArrayBuffer !== 'undefined' &&
     crossOriginIsolated;

   if (supportsSharedMemory) {
     // Use SharedArrayBuffer for zero-copy
     return new SharedArrayBuffer(size);
   } else {
     // Fall back to transferable ArrayBuffer (still fast, but moves ownership)
     return new ArrayBuffer(size);
   }
   ```

2. **Deployment Configuration**
   - Document required headers for all deployment targets
   - Provide sample nginx/Caddy/Vercel configs
   - Test in CI with proper headers

3. **Fallback Path**
   - `Transferable` ArrayBuffers work without headers
   - Performance hit is minimal for most use cases (~2x slower transfer)

**Residual Risk**: Self-hosted deployments may misconfigure headers.

---

### Risk 3: BigInt Performance

**Risk Level**: 🟢 Low

**Description**: RayforceDB uses 64-bit integers extensively (I64, timestamps). JavaScript BigInt has overhead compared to Number.

**Mitigation Strategies**:

1. **Safe Conversion**
   ```typescript
   // Only convert to Number if safe
   function i64ToNumber(value: bigint): number | bigint {
     if (value >= Number.MIN_SAFE_INTEGER &&
         value <= Number.MAX_SAFE_INTEGER) {
       return Number(value);
     }
     return value;  // Keep as BigInt for large values
   }
   ```

2. **TypedArray Views**
   - Keep data as `BigInt64Array` for WASM interop
   - Only convert when displaying to user
   - Use formatters that handle BigInt

3. **Numeric Column Optimization**
   - Detect when column fits in Int32
   - Use `Int32Array` for smaller memory footprint

**Residual Risk**: Very large integers may display awkwardly in charts.

---

### Risk 4: WebSocket Reliability

**Risk Level**: 🟡 Medium

**Description**: Long-running analytical queries may time out or disconnect mid-stream.

**Mitigation Strategies**:

1. **Connection Health**
   ```typescript
   class RayfallConnection {
     private pingInterval: number;
     private lastPong: number;

     startHeartbeat() {
       this.pingInterval = setInterval(() => {
         if (Date.now() - this.lastPong > 30000) {
           this.reconnect();
         }
         this.ws.send(PING_MESSAGE);
       }, 10000);
     }
   }
   ```

2. **Automatic Reconnection**
   ```typescript
   const reconnectWithBackoff = (attempt: number) => {
     const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
     setTimeout(() => connect(), delay);
   };
   ```

3. **Query Resumption**
   - Server-side cursor support in Rayfall
   - Resume from last received chunk
   - Idempotent query execution

4. **Offline Graceful Handling**
   - Queue mutations when offline
   - Show cached data with staleness indicator
   - Sync when connection restored

**Residual Risk**: Very long queries (>5 min) may need manual retry.

---

### Risk 5: Browser Compute Budget

**Risk Level**: 🟡 Medium

**Description**: Browsers throttle background tabs and can terminate long-running scripts.

**Mitigation Strategies**:

1. **Web Worker Isolation**
   - All heavy computation in Workers
   - Main thread stays responsive
   - Workers are less aggressively throttled

2. **Chunk Processing**
   ```typescript
   // Process in chunks to avoid long task warnings
   async function processLargeDataset(data: ArrayBuffer) {
     const CHUNK_SIZE = 100000;
     const view = new DataView(data);

     for (let i = 0; i < view.byteLength; i += CHUNK_SIZE) {
       await processChunk(view, i, CHUNK_SIZE);

       // Yield to event loop periodically
       if (i % (CHUNK_SIZE * 10) === 0) {
         await new Promise(r => setTimeout(r, 0));
       }
     }
   }
   ```

3. **Progressive Results**
   - Show partial results as they compute
   - User can cancel if taking too long
   - Indicate background processing

**Residual Risk**: Heavy computations in background tabs may be slower.

---

### Risk 6: Chart Rendering Performance

**Risk Level**: 🟡 Medium

**Description**: Large datasets can overwhelm chart renderers, especially with selection highlighting.

**Mitigation Strategies**:

1. **Data Reduction**
   ```typescript
   // Downsample for charts
   function downsampleTimeSeries(
     x: BigInt64Array,
     y: Float64Array,
     targetPoints: number
   ): { x: BigInt64Array; y: Float64Array } {
     if (x.length <= targetPoints) return { x, y };

     // LTTB algorithm for perceptually accurate downsampling
     return largestTriangleThreeBuckets(x, y, targetPoints);
   }
   ```

2. **WebGL Rendering**
   - ECharts WebGL mode for large scatter plots
   - Custom WebGL renderer for heatmaps
   - Canvas fallback for older browsers

3. **Level of Detail**
   ```typescript
   // Adjust rendering based on zoom level
   function getPointSize(zoomLevel: number, dataLength: number): number {
     const baseSize = 4;
     const scaleFactor = Math.max(1, dataLength / 10000);
     return baseSize / (scaleFactor * zoomLevel);
   }
   ```

**Residual Risk**: Extremely dense scatter plots may require manual downsampling.

---

### Risk 7: Rayforce Expression Injection

**Risk Level**: 🟡 Medium

**Description**: User-provided filter values could potentially inject malicious Rayforce expressions.

**Mitigation Strategies**:

1. **Expression Builder (Not String Concat)**
   ```typescript
   // WRONG: String interpolation
   const expr = `(> ${column} ${value})`;  // Dangerous!

   // CORRECT: Structured expression building
   function buildFilter(column: string, op: string, value: unknown): Expression {
     // Validate column name against schema
     if (!schema.hasColumn(column)) {
       throw new Error(`Invalid column: ${column}`);
     }

     // Sanitize value based on column type
     const sanitizedValue = sanitizeValue(value, schema.getType(column));

     return {
       type: 'comparison',
       operator: op,
       left: { type: 'column', name: column },
       right: { type: 'literal', value: sanitizedValue }
     };
   }
   ```

2. **Value Whitelisting**
   ```typescript
   function sanitizeValue(value: unknown, type: RayforceType): unknown {
     switch (type) {
       case 'i64':
       case 'f64':
         if (typeof value !== 'number' && typeof value !== 'bigint') {
           throw new Error('Expected numeric value');
         }
         return value;

       case 'symbol':
         if (typeof value !== 'string') {
           throw new Error('Expected string value');
         }
         // Escape or reject special characters
         return value.replace(/[`'"()]/g, '');

       // ... etc
     }
   }
   ```

3. **Expression AST**
   - Never build expressions from raw strings
   - Compile from structured AST to Rayforce syntax
   - Validate AST before compilation

**Residual Risk**: Edge cases in sanitization may exist; defense in depth with server-side validation.

---

### Risk 8: Tauri Migration Complexity

**Risk Level**: 🟢 Low

**Description**: Future Tauri desktop version must work without architectural changes.

**Mitigation Strategies**:

1. **Platform Abstraction Layer**
   ```typescript
   // src/core/platform/index.ts
   interface Platform {
     storage: StorageAdapter;
     network: NetworkAdapter;
     filesystem: FilesystemAdapter;
   }

   // Browser implementation
   export const browserPlatform: Platform = {
     storage: new IndexedDBStorage(),
     network: new WebSocketNetwork(),
     filesystem: new FileAPIFilesystem()
   };

   // Tauri implementation (future)
   export const tauriPlatform: Platform = {
     storage: new TauriStorage(),
     network: new TauriTCPNetwork(),  // Raw TCP for Rayfall
     filesystem: new TauriFSFilesystem()
   };
   ```

2. **Core Independence**
   - Core model has no browser-specific imports
   - Platform detected at startup
   - Feature flags for platform capabilities

3. **Shared Rendering**
   - React + Canvas work identically in Tauri
   - WASM Workers work identically
   - Only I/O adapters change

**Residual Risk**: Tauri-specific features may be underutilized.

---

## Where WebAssembly Provides Real Benefits

### ✅ High-Value WASM Use Cases

| Use Case | Benefit | Alternative | WASM Advantage |
|----------|---------|-------------|----------------|
| **Local filtering** | Instant (<16ms) filter feedback | Server roundtrip | 100x faster |
| **Aggregations** | Local sum/avg/min/max | Server roundtrip | 50x faster |
| **Crossfilter** | Real-time brush linking | Not feasible | Essential |
| **Type-safe parsing** | Native columnar formats | JSON parsing | 10x faster |
| **Sorting** | SIMD-accelerated sort | JS Array.sort | 5x faster |
| **Cache** | Query result cache | LocalStorage | Memory-efficient |

### ⚠️ Marginal WASM Use Cases

| Use Case | Reality | Recommendation |
|----------|---------|----------------|
| **Simple arithmetic** | JS JIT is competitive | Use JS |
| **String operations** | UTF-8 overhead | Use JS |
| **Small datasets** | Overhead > benefit | Use JS |
| **UI rendering** | DOM is JS-native | Use React |

### ❌ Where WASM Doesn't Help

| Use Case | Reason | Solution |
|----------|--------|----------|
| **Network I/O** | WASM can't open sockets | JS WebSocket |
| **DOM manipulation** | Requires JS bridge | React |
| **File I/O** | Requires JS bridge | File API |
| **Large joins** | Memory limits | Server-side |

---

## Scaling Strategy

### Small Scale (Demo/Personal)

```
┌───────────────────────────────────────┐
│              Browser                  │
│  ┌─────────────────────────────────┐  │
│  │  Local WASM Rayforce            │  │
│  │  - Full dataset in memory       │  │
│  │  - All queries local            │  │
│  │  - File-based persistence       │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
        Dataset size: < 10M rows
        Memory usage: < 500MB
        Latency: < 50ms all queries
```

### Medium Scale (Team/Department)

```
┌───────────────────────────────────────┐
│              Browser                  │
│  ┌─────────────────────────────────┐  │
│  │  Local WASM Rayforce (Cache)    │  │
│  │  - Hot data cached locally      │  │
│  │  - Filters/aggregates local     │  │
│  │  - Heavy queries to server      │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
              ▲
              │ WebSocket (Rayfall)
              ▼
┌───────────────────────────────────────┐
│         Rayforce Server               │
│  - Full dataset                       │
│  - Complex queries                    │
│  - Streaming results                  │
└───────────────────────────────────────┘
        Dataset size: 10M - 1B rows
        Cache: 1M rows local
        Latency: < 500ms complex queries
```

### Large Scale (Enterprise)

```
┌───────────────────────────────────────┐
│              Browser                  │
│  ┌─────────────────────────────────┐  │
│  │  Local WASM Rayforce (Cache)    │  │
│  │  - Materialized views cached    │  │
│  │  - Crossfilter local            │  │
│  │  - Query routing                │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
              ▲
              │ WebSocket (Rayfall)
              ▼
┌───────────────────────────────────────┐
│         Load Balancer                 │
└───────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│ RF-1  │ │ RF-2  │ │ RF-3  │  Query Nodes
└───────┘ └───────┘ └───────┘
    │         │         │
    └─────────┴─────────┘
              │
              ▼
┌───────────────────────────────────────┐
│      Distributed Storage              │
│  (Parquet/Delta Lake/etc)             │
└───────────────────────────────────────┘
        Dataset size: 1B+ rows
        Parallel query execution
        Horizontal scaling
```

---

## Risk Matrix Summary

| Risk | Likelihood | Impact | Mitigation | Status |
|------|------------|--------|------------|--------|
| WASM memory limits | Medium | High | Streaming + LRU | Planned |
| SharedArrayBuffer | Medium | Medium | Progressive enhancement | Planned |
| BigInt performance | Low | Low | Safe conversion | Planned |
| WebSocket reliability | Medium | Medium | Reconnection + heartbeat | Planned |
| Browser compute budget | Medium | Low | Worker isolation | Planned |
| Chart rendering perf | Medium | Medium | Downsampling + WebGL | Planned |
| Expression injection | Medium | High | Expression AST | Planned |
| Tauri migration | Low | Low | Platform abstraction | Planned |

---

## Conclusion

WebAssembly provides **decisive advantages** for:
- Local compute (filters, aggregates, crossfilter)
- Zero-copy data handling
- Type-safe columnar processing

The identified risks are **manageable** with the mitigation strategies outlined. The architecture is designed to gracefully degrade when browser limitations are encountered, falling back to server-side processing for operations that exceed local capabilities.

The scaling path from browser demo to enterprise deployment is clear, with the local WASM layer serving as a smart cache and interactive compute engine at all scales.

