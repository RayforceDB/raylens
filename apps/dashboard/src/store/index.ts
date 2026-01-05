import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  username: string;
  role: 'admin' | 'viewer' | 'editor';
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type WidgetType = 'grid' | 'chart' | 'text' | 'query-editor' | 'control';
export type ChartType = 'line' | 'bar' | 'candlestick' | 'pie' | 'scatter' | 'area';

export interface QueryBinding {
  queryId: string;
  refreshInterval: number; // ms, 0 = manual only
  autoRun: boolean;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  binding?: QueryBinding;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface Query {
  id: string;
  name: string;
  code: string;
  lastRun?: number;
  lastResult?: unknown;
  lastError?: string;
  isRunning: boolean;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  dashboards: Dashboard[];
  queries: Query[];
  activeDashboardId: string | null;
  serverUrl: string;
}

// App modes
export type AppMode = 'dev' | 'live';

// ============================================================================
// STORE STATE
// ============================================================================

interface LensState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  
  // Connection
  connectionStatus: ConnectionStatus;
  serverUrl: string;
  
  // App Mode
  appMode: AppMode;
  
  // Workspace
  workspace: Workspace;
  
  // UI State
  selectedWidgetId: string | null;
  selectedQueryId: string | null;
  sidebarTab: 'queries' | 'widgets' | 'settings';
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  
  // Auth actions
  login: (user: User) => void;
  logout: () => void;
  
  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  setServerUrl: (url: string) => void;
  setAppMode: (mode: AppMode) => void;
  toggleAppMode: () => void;
  
  // Query actions
  addQuery: (name: string, code: string) => string;
  updateQuery: (id: string, updates: Partial<Query>) => void;
  deleteQuery: (id: string) => void;
  setQueryResult: (id: string, result: unknown) => void;
  setQueryError: (id: string, error: string) => void;
  setQueryRunning: (id: string, running: boolean) => void;
  
  // Dashboard actions
  addDashboard: (name: string) => string;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => void;
  deleteDashboard: (id: string) => void;
  setActiveDashboard: (id: string) => void;
  
  // Widget actions
  addWidget: (dashboardId: string, widget: Omit<Widget, 'id'>) => string;
  updateWidget: (dashboardId: string, widgetId: string, updates: Partial<Widget>) => void;
  deleteWidget: (dashboardId: string, widgetId: string) => void;
  
  // UI actions
  setSelectedWidget: (id: string | null) => void;
  setSelectedQuery: (id: string | null) => void;
  setSidebarTab: (tab: 'queries' | 'widgets' | 'settings') => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;
  
  // Workspace actions
  loadWorkspace: (workspace: Workspace) => void;
  exportWorkspace: () => Workspace;
  resetWorkspace: () => void;
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const createDefaultWorkspace = (): Workspace => {
  const dashboardId = uuid();
  const tradeCountId = uuid();
  const quoteCountId = uuid();
  const tradeColumnsId = uuid();
  const tradesBySymbolId = uuid();
  
  return {
    id: uuid(),
    name: 'Trading Analytics',
    serverUrl: 'ws://localhost:8765',
    activeDashboardId: dashboardId,
    queries: [
      {
        id: tradeCountId,
        name: 'Trade Count',
        code: '(count trades)',
        isRunning: false,
      },
      {
        id: quoteCountId,
        name: 'Quote Count', 
        code: '(count quotes)',
        isRunning: false,
      },
      {
        id: tradeColumnsId,
        name: 'Trade Columns',
        code: '(cols trades)',
        isRunning: false,
      },
      {
        id: tradesBySymbolId,
        name: 'Trades by Symbol',
        code: '(select {cnt: (count Sym) from: trades by: Sym})',
        isRunning: false,
      },
      {
        id: uuid(),
        name: 'Recent Trades',
        code: '(take trades 10)',
        isRunning: false,
      },
    ],
    dashboards: [
      {
        id: dashboardId,
        name: 'Trades Dashboard',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        widgets: [
          // Grid: Trades by Symbol
          {
            id: uuid(),
            type: 'grid',
            title: 'Trades by Symbol',
            binding: { queryId: tradesBySymbolId, refreshInterval: 10000, autoRun: true },
            config: {
              columnColorConfigs: [
                { column: 'cnt', type: 'preset', preset: 'positive-negative' }
              ]
            },
            position: { x: 0, y: 0, w: 6, h: 6 },
          },
          // Text: Total Trade Count
          {
            id: uuid(),
            type: 'text',
            title: 'Total Trades',
            binding: { queryId: tradeCountId, refreshInterval: 5000, autoRun: true },
            config: { fontSize: 48, prefix: '', suffix: ' trades' },
            position: { x: 6, y: 0, w: 3, h: 3 },
          },
          // Chart: Pie chart of trades by symbol
          {
            id: uuid(),
            type: 'chart',
            title: 'Symbol Distribution',
            binding: { queryId: tradesBySymbolId, refreshInterval: 10000, autoRun: true },
            config: { chartType: 'pie' },
            position: { x: 9, y: 0, w: 3, h: 3 },
          },
          // Chart: Bar chart of trades by symbol
          {
            id: uuid(),
            type: 'chart',
            title: 'Trades per Symbol',
            binding: { queryId: tradesBySymbolId, refreshInterval: 10000, autoRun: true },
            config: { chartType: 'bar' },
            position: { x: 6, y: 3, w: 6, h: 3 },
          },
        ],
      },
    ],
  };
};

// ============================================================================
// STORE
// ============================================================================

// Check for saved auth in sessionStorage
const getSavedAuth = (): User | null => {
  try {
    const saved = sessionStorage.getItem('raylens-auth');
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
};

export const useLensStore = create<LensState>()((set, get) => ({
  // Initial state
  user: getSavedAuth(),
  isAuthenticated: getSavedAuth() !== null,
  connectionStatus: 'disconnected',
  serverUrl: 'ws://localhost:8765',
  appMode: 'dev',
  workspace: createDefaultWorkspace(),
  selectedWidgetId: null,
  selectedQueryId: null,
  sidebarTab: 'queries',
  bottomPanelOpen: true,
  bottomPanelHeight: 300,
  
  // Auth actions
  login: (user) => {
    sessionStorage.setItem('raylens-auth', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    sessionStorage.removeItem('raylens-auth');
    set({ user: null, isAuthenticated: false });
  },
  
  // Connection actions
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  
  setServerUrl: (url) => set((state) => ({
    serverUrl: url,
    workspace: { ...state.workspace, serverUrl: url },
  })),
  
  // App mode actions
  setAppMode: (mode) => set({ appMode: mode }),
  toggleAppMode: () => set((state) => ({ 
    appMode: state.appMode === 'dev' ? 'live' : 'dev',
    // Auto-hide panels when switching to live mode
    bottomPanelOpen: state.appMode === 'live' ? state.bottomPanelOpen : false,
  })),
  
  // Query actions
  addQuery: (name, code) => {
    const id = uuid();
    set((state) => ({
      workspace: {
        ...state.workspace,
        queries: [...state.workspace.queries, { id, name, code, isRunning: false }],
      },
    }));
    return id;
  },
  
  updateQuery: (id, updates) => set((state) => ({
    workspace: {
      ...state.workspace,
      queries: state.workspace.queries.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    },
  })),
  
  deleteQuery: (id) => set((state) => ({
    workspace: {
      ...state.workspace,
      queries: state.workspace.queries.filter((q) => q.id !== id),
    },
  })),
  
  setQueryResult: (id, result) => {
    console.log('[Store] setQueryResult:', { id, resultType: (result as { type?: string })?.type, result });
    return set((state) => ({
      workspace: {
        ...state.workspace,
        queries: state.workspace.queries.map((q) =>
          q.id === id
            ? { ...q, lastResult: result, lastRun: Date.now(), lastError: undefined, isRunning: false }
            : q
        ),
      },
    }));
  },
  
  setQueryError: (id, error) => set((state) => ({
    workspace: {
      ...state.workspace,
      queries: state.workspace.queries.map((q) =>
        q.id === id ? { ...q, lastError: error, isRunning: false } : q
      ),
    },
  })),
  
  setQueryRunning: (id, running) => set((state) => ({
    workspace: {
      ...state.workspace,
      queries: state.workspace.queries.map((q) =>
        q.id === id ? { ...q, isRunning: running } : q
      ),
    },
  })),
  
  // Dashboard actions
  addDashboard: (name) => {
    const id = uuid();
    set((state) => ({
      workspace: {
        ...state.workspace,
        dashboards: [
          ...state.workspace.dashboards,
          { id, name, widgets: [], createdAt: Date.now(), updatedAt: Date.now() },
        ],
        activeDashboardId: id,
      },
    }));
    return id;
  },
  
  updateDashboard: (id, updates) => set((state) => ({
    workspace: {
      ...state.workspace,
      dashboards: state.workspace.dashboards.map((d) =>
        d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d
      ),
    },
  })),
  
  deleteDashboard: (id) => set((state) => {
    const dashboards = state.workspace.dashboards.filter((d) => d.id !== id);
    return {
      workspace: {
        ...state.workspace,
        dashboards,
        activeDashboardId:
          state.workspace.activeDashboardId === id
            ? dashboards[0]?.id || null
            : state.workspace.activeDashboardId,
      },
    };
  }),
  
  setActiveDashboard: (id) => set((state) => ({
    workspace: { ...state.workspace, activeDashboardId: id },
  })),
  
  // Widget actions
  addWidget: (dashboardId, widget) => {
    const id = uuid();
    set((state) => ({
      workspace: {
        ...state.workspace,
        dashboards: state.workspace.dashboards.map((d) =>
          d.id === dashboardId
            ? { ...d, widgets: [...d.widgets, { ...widget, id }], updatedAt: Date.now() }
            : d
        ),
      },
    }));
    return id;
  },
  
  updateWidget: (dashboardId, widgetId, updates) => set((state) => ({
    workspace: {
      ...state.workspace,
      dashboards: state.workspace.dashboards.map((d) =>
        d.id === dashboardId
          ? {
              ...d,
              widgets: d.widgets.map((w) =>
                w.id === widgetId ? { ...w, ...updates } : w
              ),
              updatedAt: Date.now(),
            }
          : d
      ),
    },
  })),
  
  deleteWidget: (dashboardId, widgetId) => set((state) => ({
    workspace: {
      ...state.workspace,
      dashboards: state.workspace.dashboards.map((d) =>
        d.id === dashboardId
          ? {
              ...d,
              widgets: d.widgets.filter((w) => w.id !== widgetId),
              updatedAt: Date.now(),
            }
          : d
      ),
    },
  })),
  
  // UI actions
  setSelectedWidget: (id) => set({ selectedWidgetId: id }),
  setSelectedQuery: (id) => set({ selectedQueryId: id }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
  
  // Workspace actions
  loadWorkspace: (workspace) => set({
    workspace: {
      ...workspace,
      // Clear transient query data when loading
      queries: workspace.queries.map(q => ({
        ...q,
        lastResult: undefined,
        lastRun: undefined,
        lastError: undefined,
        isRunning: false,
      })),
    },
    selectedWidgetId: null,
    selectedQueryId: null,
  }),
  
  exportWorkspace: () => JSON.parse(JSON.stringify(get().workspace)),
  
  resetWorkspace: () => set({
    workspace: createDefaultWorkspace(),
    selectedWidgetId: null,
    selectedQueryId: null,
  }),
}));
