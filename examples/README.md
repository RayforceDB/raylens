# RayLens Examples

## Pre-built Workspaces

The `apps/dashboard/public/workspaces/` directory contains ready-to-use workspace configurations:

### 1. Trading Dashboard (`trading-demo.json`)
Full analytics dashboard for trading data:
- Trade count and volume metrics
- Trades by symbol breakdown
- Recent trades grid
- Live price updates

**URL:** `http://localhost:3000/?workspace=trading-demo`

## Creating Your Own Workspace

1. Create a JSON file with this structure:

```json
{
  "id": "my-workspace",
  "name": "My Custom Dashboard",
  "serverUrl": "ws://localhost:8765",
  "queries": [
    {
      "id": "qry-1",
      "name": "My Query",
      "code": "(take trades 100)"
    }
  ],
  "dashboards": [
    {
      "id": "dash-1",
      "name": "Main",
      "widgets": [
        {
          "id": "widget-1",
          "type": "grid",
          "title": "Trades Table",
          "binding": {
            "queryId": "qry-1",
            "refreshInterval": 5000,
            "autoRun": true
          },
          "config": {},
          "position": { "x": 0, "y": 0, "w": 12, "h": 6 }
        }
      ]
    }
  ]
}
```

2. Place it in `apps/dashboard/public/workspaces/my-workspace.json`

3. Access via `http://localhost:3000/?workspace=my-workspace`

## Sharing Workspaces

From the UI:
1. Click "Share" button in Dev mode
2. The share URL is copied to clipboard
3. Anyone with the URL can load your exact workspace configuration

## Modes

### Dev Mode
- Full editing capabilities
- Query creation and editing
- Widget configuration
- Dashboard management

### Live Mode
- Clean presentation view
- Auto-refresh continues
- Perfect for sharing/presenting
