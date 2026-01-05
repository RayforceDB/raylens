# RayLens

A reactive analytics and dashboarding system for Rayforce. Build real-time dashboards with live data grids, charts, and custom queries.

## Features

- **Query Editor** - Monaco-based editor for writing Rayfall queries
- **Data Grids** - AG Grid powered tables with sorting, filtering, and real-time updates
- **Charts** - ECharts visualizations (line, bar, pie, candlestick, area)
- **Live Binding** - Connect queries to widgets with configurable refresh intervals
- **Drag & Drop** - Build dashboards by dragging widgets from the palette
- **Workspaces** - Save, load, export, import, and share dashboards
- **Real-time** - WebSocket connection to Rayforce server with push updates
- **Dev/Live Modes** - Switch between development and presentation views

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## Requirements

- Node.js 18+
- Rayforce server running on `ws://localhost:8765`

## Creating Dashboards

1. **Connect** - Click "Connect" to establish connection to Rayforce server
2. **Create Queries** - Use the sidebar to create Rayfall queries
3. **Add Widgets** - Drag widgets from the palette onto the dashboard
4. **Configure Binding** - Click ⚙ on a widget to bind it to a query
5. **Set Refresh** - Configure auto-refresh intervals for live data
6. **Save & Share** - Export workspaces as JSON or share via URL
7. **Go Live** - Switch to Live mode for a clean presentation view

## Widget Types

| Widget | Description |
|--------|-------------|
| **Data Grid** | AG Grid table with sorting, filtering, column resizing |
| **Line Chart** | Time series visualization |
| **Bar Chart** | Categorical data comparison |
| **Pie Chart** | Distribution visualization |
| **Candlestick** | OHLC financial data |
| **Text/KPI** | Single value display with formatting |

## Query Examples

```lisp
; Get recent trades
(take trades 10)

; Count rows
(count trades)

; Group by symbol
(select {cnt: (count Sym) from: trades by: Sym})

; Filter by condition
(select {from: trades where: (> Size 100)})

; Calculate total
(sum trades.Size)
```

## Project Structure

```
raylens/
├── apps/
│   └── dashboard/          # Main React application
│       ├── src/
│       │   ├── components/ # React components
│       │   ├── lib/        # Rayforce client, utilities
│       │   ├── store/      # Zustand state management
│       │   └── styles/     # CSS styles
│       └── public/
│           └── workspaces/ # Demo workspace files
├── package.json
└── README.md
```

## Tech Stack

- **React** - UI framework
- **Monaco Editor** - Query editing with Rayfall syntax highlighting
- **AG Grid** - Data tables with pagination and column styling
- **ECharts** - Charts & visualizations
- **Zustand** - State management
- **Vite** - Build tool

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## License

MIT
