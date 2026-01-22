import { useState, useEffect, useRef } from 'react';
import { useLensStore } from '../store';
import { toast, confirm } from './Toast';
import {
  saveWorkspaceToStorage,
  exportWorkspaceToFile,
  importWorkspaceFromFile,
  getShareUrl,
  clearWorkspaceStorage,
} from '../lib/workspace';

// FPS counter hook
function useFps() {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const rafId = useRef<number>();

  useEffect(() => {
    const updateFps = () => {
      frameCount.current++;
      const now = performance.now();
      const delta = now - lastTime.current;

      if (delta >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / delta));
        frameCount.current = 0;
        lastTime.current = now;
      }

      rafId.current = requestAnimationFrame(updateFps);
    };

    rafId.current = requestAnimationFrame(updateFps);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return fps;
}

interface HeaderProps {
  onConnect: () => void;
}

export function Header({ onConnect }: HeaderProps) {
  const workspace = useLensStore(state => state.workspace);
  const workspaceName = workspace.name;
  const connectionStatus = useLensStore(state => state.connectionStatus);
  const serverUrl = useLensStore(state => state.serverUrl);
  const setServerUrl = useLensStore(state => state.setServerUrl);
  const appMode = useLensStore(state => state.appMode);
  const user = useLensStore(state => state.user);
  const logout = useLensStore(state => state.logout);
  
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlValue, setUrlValue] = useState(serverUrl);
  const fps = useFps();

  const handleUrlSubmit = () => {
    setServerUrl(urlValue);
    setEditingUrl(false);
    onConnect();
  };
  
  const isDevMode = appMode === 'dev';
  
  return (
    <header className={`header ${appMode}-mode`}>
      <div className="header-left">
        <div className="header-logo">
          <img
            src="/assets/logo_dark_full.svg"
            alt="Rayforce DB"
            className="logo"
            style={{ height: 36 }}
          />
        </div>
        
        <div className="header-divider" />
        
        <div className="workspace-name">
          {isDevMode ? (
            <input
              type="text"
              value={workspaceName}
              onChange={() => {}}
              placeholder="Workspace name"
            />
          ) : (
            <span className="workspace-name-display">{workspaceName}</span>
          )}
        </div>
      </div>
      
      <div className="header-center">
        <DashboardTabs />
      </div>
      
      <div className="header-right">
        {/* Mode Switcher */}
        <div className="mode-switcher">
          <button
            className={`mode-btn ${appMode === 'dev' ? 'active' : ''}`}
            onClick={() => useLensStore.getState().setAppMode('dev')}
            title="Development Mode - Edit queries, configure widgets"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Dev
          </button>
          <button
            className={`mode-btn ${appMode === 'live' ? 'active' : ''}`}
            onClick={() => useLensStore.getState().setAppMode('live')}
            title="Live Mode - View-only dashboard"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Live
          </button>
        </div>
        
        <div className="header-divider" />
        
        {/* Connection Status */}
        <div className="connection-status">
          <span 
            className={`status-dot status-${connectionStatus === 'connected' ? 'connected' : connectionStatus === 'connecting' ? 'connecting' : 'disconnected'}`} 
          />
          {isDevMode && editingUrl ? (
            <input
              type="text"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onBlur={handleUrlSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              className="connection-url"
              autoFocus
              style={{ width: 150 }}
            />
          ) : isDevMode ? (
            <span 
              className="connection-url" 
              onClick={() => setEditingUrl(true)}
              style={{ cursor: 'pointer' }}
            >
              {serverUrl}
            </span>
          ) : (
            <span className="connection-label">
              {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          )}
        </div>

        {/* FPS Counter */}
        <div className="fps-counter" title="Frames per second">
          <span className={`fps-value ${fps < 30 ? 'fps-low' : fps < 50 ? 'fps-medium' : 'fps-good'}`}>
            {fps}
          </span>
          <span className="fps-label">FPS</span>
        </div>

        {connectionStatus !== 'connected' && (
          <button className="btn btn-primary btn-sm" onClick={onConnect}>
            Connect
          </button>
        )}

        {/* Dev Mode Actions */}
        {isDevMode && (
          <>
            <div className="header-divider" />
            
            <button 
              className="btn btn-sm" 
              onClick={() => {
                saveWorkspaceToStorage(workspace);
                toast.success('Workspace saved!');
              }}
              title="Save workspace"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M5.5 3A2.5 2.5 0 003 5.5v9A2.5 2.5 0 005.5 17h9a2.5 2.5 0 002.5-2.5v-7.086a1.5 1.5 0 00-.44-1.06l-2.914-2.915a1.5 1.5 0 00-1.06-.439H5.5zM6 6a1 1 0 011-1h6a1 1 0 011 1v2a1 1 0 01-1 1H7a1 1 0 01-1-1V6zm6 6a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              Save
            </button>
            <button 
              className="btn btn-sm" 
              onClick={() => exportWorkspaceToFile(workspace)}
              title="Export to file"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/>
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/>
              </svg>
              Export
            </button>
            <button 
              className="btn btn-sm" 
              onClick={async () => {
                const imported = await importWorkspaceFromFile();
                if (imported) {
                  useLensStore.getState().loadWorkspace(imported);
                  toast.success('Workspace imported!');
                }
              }}
              title="Import from file"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z"/>
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/>
              </svg>
              Import
            </button>
            <button 
              className="btn btn-sm" 
              onClick={() => {
                const url = getShareUrl(workspace);
                navigator.clipboard.writeText(url);
                toast.success('Share URL copied to clipboard!');
              }}
              title="Copy share link"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z"/>
                <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z"/>
              </svg>
              Share
            </button>
            <button 
              className="btn btn-sm btn-danger" 
              onClick={async () => {
                const confirmed = await confirm('Reset workspace to defaults? This will clear all saved data.', {
                  title: 'Reset Workspace',
                  confirmText: 'Reset',
                  type: 'danger',
                });
                if (confirmed) {
                  clearWorkspaceStorage();
                  useLensStore.getState().resetWorkspace();
                  window.location.reload();
                }
              }}
              title="Reset to default workspace"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd"/>
              </svg>
              Reset
            </button>
          </>
        )}
        
        {/* Live Mode - minimal controls */}
        {!isDevMode && (
          <>
            <button 
              className="btn btn-sm" 
              onClick={() => window.location.reload()}
              title="Refresh dashboard"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd"/>
              </svg>
              Refresh
            </button>
          </>
        )}
        
        {/* User menu */}
        <div className="header-divider" />
        <div className="user-menu">
          <span className="user-info">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z"/>
            </svg>
            {user?.username}
          </span>
          <button 
            className="btn btn-sm btn-ghost" 
            onClick={async () => {
              const confirmed = await confirm('Sign out of RayLens?', {
                title: 'Sign Out',
                confirmText: 'Sign Out',
              });
              if (confirmed) {
                logout();
              }
            }}
            title="Sign out"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd"/>
              <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function DashboardTabs() {
  const dashboards = useLensStore(state => state.workspace.dashboards);
  const activeDashboardId = useLensStore(state => state.workspace.activeDashboardId);
  const setActiveDashboard = useLensStore(state => state.setActiveDashboard);
  const addDashboard = useLensStore(state => state.addDashboard);
  const appMode = useLensStore(state => state.appMode);
  
  return (
    <div className="dashboard-tabs">
      {dashboards.map(dashboard => (
        <button
          key={dashboard.id}
          className={`dashboard-tab ${dashboard.id === activeDashboardId ? 'active' : ''}`}
          onClick={() => setActiveDashboard(dashboard.id)}
        >
          {dashboard.name}
        </button>
      ))}
      {appMode === 'dev' && (
        <button 
          className="dashboard-tab-add"
          onClick={() => addDashboard('New Dashboard')}
          title="Add dashboard"
        >
          +
        </button>
      )}
    </div>
  );
}
