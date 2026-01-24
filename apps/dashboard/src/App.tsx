import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLensStore } from './store';
import { getRayforceClient, RayforceClient } from './lib/rayforce';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardCanvas } from './components/DashboardCanvas';
import { BottomPanel } from './components/BottomPanel';
import { ToastContainer, ConfirmModal } from './components/Toast';
import { Login } from './components/Login';
import {
  parseShareUrl,
  loadWorkspaceFromStorage,
  loadUIStateFromStorage,
  loadServerConnectionsFromStorage,
  scheduleAutoSave,
} from './lib/workspace';
import './styles/app.css';

// Export client for use in components
export let rayforceClient: RayforceClient | null = null;

export function App() {
  const isAuthenticated = useLensStore(state => state.isAuthenticated);
  const setConnectionStatus = useLensStore(state => state.setConnectionStatus);
  const bottomPanelOpen = useLensStore(state => state.bottomPanelOpen);
  const bottomPanelHeight = useLensStore(state => state.bottomPanelHeight);
  const loadWorkspace = useLensStore(state => state.loadWorkspace);
  const appMode = useLensStore(state => state.appMode);
  const sidebarTab = useLensStore(state => state.sidebarTab);
  const workspace = useLensStore(state => state.workspace);
  const serverConnections = useLensStore(state => state.serverConnections);

  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Initialize SDK on mount
  useEffect(() => {
    const init = async () => {
      try {
        console.log('[App] Initializing Rayforce SDK...');
        const client = getRayforceClient();
        await client.loadSDK();
        rayforceClient = client;
        console.log('[App] SDK ready');
      } catch (err) {
        console.error('[App] SDK init failed:', err);
        setError(`SDK: ${err}`);
        // Still allow app to run without SDK
        rayforceClient = getRayforceClient();
      }
      setSdkReady(true);
    };
    init();
  }, []);

  // Load workspace, UI state, and server connections from storage on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    // Check URL hash for shared workspace first
    const sharedWorkspace = parseShareUrl();
    if (sharedWorkspace) {
      loadWorkspace(sharedWorkspace);
      console.log('[App] Loaded shared workspace:', sharedWorkspace.name);
      return;
    }

    // Load workspace from storage
    const savedWorkspace = loadWorkspaceFromStorage();
    if (savedWorkspace) {
      loadWorkspace(savedWorkspace);
      console.log('[App] Loaded saved workspace:', savedWorkspace.name);
    }

    // Load UI state
    const savedUIState = loadUIStateFromStorage();
    if (savedUIState) {
      useLensStore.setState({
        appMode: savedUIState.appMode,
        sidebarTab: savedUIState.sidebarTab,
        bottomPanelOpen: savedUIState.bottomPanelOpen,
        bottomPanelHeight: savedUIState.bottomPanelHeight,
      });
      console.log('[App] Loaded saved UI state');
    }

    // Load server connections
    const savedConnections = loadServerConnectionsFromStorage();
    if (savedConnections.length > 0) {
      useLensStore.setState({ serverConnections: savedConnections });
      console.log('[App] Loaded saved server connections:', savedConnections.length);
    }
  }, [loadWorkspace]);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    // Skip auto-save during initial load
    if (!initialLoadDone.current) return;

    scheduleAutoSave(
      workspace,
      { appMode, sidebarTab, bottomPanelOpen, bottomPanelHeight },
      serverConnections
    );
  }, [workspace, appMode, sidebarTab, bottomPanelOpen, bottomPanelHeight, serverConnections]);

  // Connect to embedded Rayforce when SDK is ready
  useEffect(() => {
    if (!sdkReady || !rayforceClient || !isAuthenticated) return;

    // Set up event handlers for connection status
    const handleConnected = () => setConnectionStatus('connected');
    const handleDisconnected = () => setConnectionStatus('disconnected');
    const handleError = () => setConnectionStatus('error');

    rayforceClient.on('connected', handleConnected);
    rayforceClient.on('disconnected', handleDisconnected);
    rayforceClient.on('error', handleError);

    // Connect to embedded Rayforce (no URL needed)
    rayforceClient.connect('native').catch(err => {
      console.error('[App] Connection failed:', err);
      setConnectionStatus('error');
    });

    return () => {
      rayforceClient?.off('connected', handleConnected);
      rayforceClient?.off('disconnected', handleDisconnected);
      rayforceClient?.off('error', handleError);
      rayforceClient?.disconnect();
    };
  }, [sdkReady, isAuthenticated, setConnectionStatus]);

  // Auto-reconnect saved server connections when SDK is ready
  const autoReconnectDone = useRef(false);
  useEffect(() => {
    if (!sdkReady || !isAuthenticated || autoReconnectDone.current) return;
    if (serverConnections.length === 0) return;

    autoReconnectDone.current = true;
    const updateServerConnectionStatus = useLensStore.getState().updateServerConnectionStatus;

    console.log('[App] Auto-reconnecting saved server connections...');

    // Reconnect each saved connection
    serverConnections.forEach(async (conn) => {
      // Skip if already connected
      if (conn.status === 'connected') return;

      updateServerConnectionStatus(conn.id, 'connecting');

      try {
        await invoke('connect_server', {
          alias: conn.alias,
          host: conn.host,
          port: conn.port,
        });
        updateServerConnectionStatus(conn.id, 'connected');
        console.log(`[App] Auto-reconnected to ${conn.alias}`);
      } catch (err) {
        updateServerConnectionStatus(conn.id, 'error', String(err));
        console.warn(`[App] Failed to auto-reconnect ${conn.alias}:`, err);
      }
    });
  }, [sdkReady, isAuthenticated, serverConnections]);
  
  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Login />
        <ToastContainer />
      </>
    );
  }
  
  // Show loading state while SDK initializes
  if (!sdkReady) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <div className="loading-text">
          {error || 'Loading Rayforce SDK...'}
        </div>
      </div>
    );
  }
  
  const isDevMode = appMode === 'dev';
  
  return (
    <div className={`app-container ${appMode}-mode`}>
      <Header />
      
      <div className="app-main">
        {isDevMode && <Sidebar />}
        
        <div className="app-content">
          <DashboardCanvas />
          
          {isDevMode && bottomPanelOpen && (
            <BottomPanel height={bottomPanelHeight} />
          )}
        </div>
      </div>
      
      <ToastContainer />
      <ConfirmModal />
    </div>
  );
}
