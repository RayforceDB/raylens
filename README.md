# RayLens

> Browser-first, timestored pulse analytical application built on RayforceDB

RayLens is a high-performance analytical application that runs entirely in the browser, leveraging WebAssembly to embed RayforceDB for local computation while connecting to remote Rayforce nodes for heavy queries.

## Features

- 🚀 **WebAssembly-Powered** - RayforceDB runs in the browser via WASM for instant local queries
- 📊 **Zero-Copy Data** - TypedArray views directly over WASM memory for maximum performance
- 🔄 **Crossfilter** - Real-time brushing and linking across multiple visualizations
- 📈 **Canvas Charts** - High-performance time-series and statistical visualizations
- 🎯 **Drag & Drop** - Intuitive shelf-based chart construction
- 🌐 **Rayfall Protocol** - Connect to remote Rayforce clusters for large-scale analytics

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- Rayforce WASM SDK (from `../rayforce-wasm`)

### Installation

```bash
# Clone the repository
cd raylens

# Install dependencies
pnpm install

# Copy WASM SDK files
pnpm run prepare:wasm

# Start development server
pnpm run dev
```

Open http://localhost:5173 in your browser.

### Development

```bash
# Run development server with HMR
pnpm run dev

# Type check
pnpm run typecheck

# Lint
pnpm run lint

# Run tests
pnpm run test

# Build for production
pnpm run build
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

### Key Concepts

1. **Local WASM Rayforce** - Handles caching, fast filtering, aggregations, and crossfilter
2. **Remote Rayforce** - Handles heavy scans, large group-bys, distributed queries
3. **Central Model** - Single Zustand store unifying all UI components
4. **Zero-Copy** - TypedArrays used throughout, no JSON serialization

### Data Flow

```
User Action → QueryPlan mutation → WASM Worker (local) → Instant UI update
                                 ↓ (parallel)
                            Rayfall query → Remote nodes → Stream results
```

## Project Structure

```
raylens/
├── src/
│   ├── core/               # Business logic
│   │   ├── store/          # Zustand store & slices
│   │   ├── rayforce/       # WASM bridge
│   │   ├── rayfall/        # Remote protocol (Phase 4)
│   │   └── model/          # Domain types
│   ├── components/         # React components
│   │   ├── layout/         # App shell, sidebar, toolbar
│   │   ├── table/          # Virtual table (Phase 2)
│   │   ├── chart/          # Charts (Phase 2)
│   │   ├── shelves/        # Drag & drop (Phase 3)
│   │   └── dashboard/      # Dashboard (Phase 5)
│   └── hooks/              # React hooks
├── workers/                # Web Workers
│   └── rayforce.worker.ts  # WASM compute worker
├── public/
│   └── rayforce/           # WASM SDK files
└── docs/                   # Documentation
```

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | UI ↔ WASM compute loop |
| Phase 1 | 🚧 In Progress | Data contracts, schema explorer |
| Phase 2 | ⏳ Planned | Virtual table + chart |
| Phase 3 | ⏳ Planned | Drag & drop shelves |
| Phase 4 | ⏳ Planned | Rayfall remote integration |
| Phase 5 | ⏳ Planned | Dashboard & persistence |
| Phase 6 | ⏳ Planned | Performance & polish |

See [ROADMAP.md](./ROADMAP.md) for detailed implementation plan.

## Tech Stack

| Concern | Technology |
|---------|------------|
| Framework | React 19 |
| Build | Vite |
| State | Zustand + Immer |
| Styling | Tailwind CSS + Radix UI |
| Table | TanStack Virtual |
| Charts | uPlot, ECharts |
| DnD | dnd-kit |
| Layout | react-grid-layout |

## Browser Support

- Chrome 89+ (WASM SIMD)
- Firefox 89+ (WASM SIMD)
- Safari 15+ (WASM SIMD)
- Edge 89+ (WASM SIMD)

## Performance Targets

- Initial load: < 2s
- WASM init: < 500ms
- Local filter: < 16ms (60fps)
- Table scroll: 60fps with 1M rows
- Chart brush: < 16ms

## License

MIT

## Links

- [RayforceDB](https://rayforcedb.com)
- [Architecture](./ARCHITECTURE.md)
- [Implementation Roadmap](./ROADMAP.md)
- [Risks & WASM Analysis](./RISKS_AND_WASM.md)
