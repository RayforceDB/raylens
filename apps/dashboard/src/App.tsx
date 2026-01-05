import { useEffect, useCallback, useState } from 'react';
import { useLensStore } from './store';
import { getRayforceClient, RayforceClient } from './lib/rayforce';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardCanvas } from './components/DashboardCanvas';
import { BottomPanel } from './components/BottomPanel';
import { ToastContainer, ConfirmModal } from './components/Toast';
import { Login } from './components/Login';
import { parseShareUrl, loadWorkspaceFromStorage } from './lib/workspace';
import './styles/app.css';

// Export client for use in components
export let rayforceClient: RayforceClient | null = null;

export function App() {
  const isAuthenticated = useLensStore(state => state.isAuthenticated);
  const serverUrl = useLensStore(state => state.serverUrl);
  const setConnectionStatus = useLensStore(state => state.setConnectionStatus);
  const bottomPanelOpen = useLensStore(state => state.bottomPanelOpen);
  const bottomPanelHeight = useLensStore(state => state.bottomPanelHeight);
  const loadWorkspace = useLensStore(state => state.loadWorkspace);
  const appMode = useLensStore(state => state.appMode);
  
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
  
  // Load workspace from URL or storage on mount
  useEffect(() => {
    // Check URL hash for shared workspace
    const sharedWorkspace = parseShareUrl();
    if (sharedWorkspace) {
      loadWorkspace(sharedWorkspace);
      console.log('[App] Loaded shared workspace:', sharedWorkspace.name);
      return;
    }
    
    // Check localStorage for saved workspace
    const savedWorkspace = loadWorkspaceFromStorage();
    if (savedWorkspace) {
      loadWorkspace(savedWorkspace);
      console.log('[App] Loaded saved workspace:', savedWorkspace.name);
    }
  }, [loadWorkspace]);
  
  // Connect to Rayforce server with IPC handshake
  const connect = useCallback(async () => {
    if (!rayforceClient) {
      console.warn('[App] SDK not ready, cannot connect');
      return;
    }
    
    try {
      setConnectionStatus('connecting');
      await rayforceClient.connect(serverUrl);
      // Status will be set by event handler
    } catch (err) {
      console.error('[App] Connection failed:', err);
      setConnectionStatus('error');
    }
  }, [serverUrl, setConnectionStatus]);
  
  // Connect when SDK is ready (run only once)
  useEffect(() => {
    if (!sdkReady || !rayforceClient || !isAuthenticated) return;
    
    // Set up event handlers
    const handleConnected = () => setConnectionStatus('connected');
    const handleDisconnected = () => setConnectionStatus('disconnected');
    const handleError = () => setConnectionStatus('error');
    
    rayforceClient.on('connected', handleConnected);
    rayforceClient.on('disconnected', handleDisconnected);
    rayforceClient.on('error', handleError);
    
    // Auto-connect with Rayforce IPC handshake
    rayforceClient.connect(serverUrl).catch(err => {
      console.error('[App] Connection failed:', err);
      setConnectionStatus('error');
    });
    
    return () => {
      rayforceClient.off('connected', handleConnected);
      rayforceClient.off('disconnected', handleDisconnected);
      rayforceClient.off('error', handleError);
      rayforceClient?.disconnect();
    };
  }, [sdkReady, isAuthenticated]); // Only depend on sdkReady and isAuthenticated
  
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
      <Header onConnect={connect} />
      
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
