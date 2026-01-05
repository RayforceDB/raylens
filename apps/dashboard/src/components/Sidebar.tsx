import { useState, useEffect, useCallback, useRef } from 'react';
import { useLensStore } from '../store';
import { rayforceClient } from '../App';
import { toast } from './Toast';

export function Sidebar() {
  const sidebarTab = useLensStore(state => state.sidebarTab);
  const setSidebarTab = useLensStore(state => state.setSidebarTab);
  const [width, setWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  
  // Handle sidebar resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: width };
    setIsResizing(true);
  }, [width]);
  
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(200, Math.min(500, resizeRef.current.startWidth + delta));
      setWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  
  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${sidebarTab === 'queries' ? 'active' : ''}`}
          onClick={() => setSidebarTab('queries')}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path d="M3 3.5A1.5 1.5 0 014.5 2h11A1.5 1.5 0 0117 3.5v3.25a.75.75 0 01-1.5 0V3.5H4.5v10.09l2.77-2.77a.75.75 0 01.976-.073l.084.073 2.67 2.67 2.67-2.67a.75.75 0 01.976-.073l.084.073 2.77 2.77V8.75a.75.75 0 011.5 0v7.75A1.5 1.5 0 0115.5 18h-11A1.5 1.5 0 013 16.5v-13z"/>
          </svg>
          Queries
        </button>
        <button
          className={`sidebar-tab ${sidebarTab === 'widgets' ? 'active' : ''}`}
          onClick={() => setSidebarTab('widgets')}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path d="M2 4.25A2.25 2.25 0 014.25 2h2.5A2.25 2.25 0 019 4.25v2.5A2.25 2.25 0 016.75 9h-2.5A2.25 2.25 0 012 6.75v-2.5zM2 13.25A2.25 2.25 0 014.25 11h2.5A2.25 2.25 0 019 13.25v2.5A2.25 2.25 0 016.75 18h-2.5A2.25 2.25 0 012 15.75v-2.5zM11 4.25A2.25 2.25 0 0113.25 2h2.5A2.25 2.25 0 0118 4.25v2.5A2.25 2.25 0 0115.75 9h-2.5A2.25 2.25 0 0111 6.75v-2.5zM11 13.25A2.25 2.25 0 0113.25 11h2.5A2.25 2.25 0 0118 13.25v2.5A2.25 2.25 0 0115.75 18h-2.5A2.25 2.25 0 0111 15.75v-2.5z"/>
          </svg>
          Widgets
        </button>
        <button
          className={`sidebar-tab ${sidebarTab === 'settings' ? 'active' : ''}`}
          onClick={() => setSidebarTab('settings')}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
          </svg>
          Settings
        </button>
      </div>
      
      <div className="sidebar-content">
        {sidebarTab === 'queries' && <QueriesPanel />}
        {sidebarTab === 'widgets' && <WidgetsPanel />}
        {sidebarTab === 'settings' && <SettingsPanel />}
      </div>
      
      {/* Resize handle */}
      <div 
        className={`resize-handle resize-handle-vertical ${isResizing ? 'active' : ''}`}
        style={{ right: 0 }}
        onMouseDown={handleResizeStart}
      />
    </aside>
  );
}

function QueriesPanel() {
  const queries = useLensStore(state => state.workspace.queries);
  const selectedQueryId = useLensStore(state => state.selectedQueryId);
  const setSelectedQuery = useLensStore(state => state.setSelectedQuery);
  const addQuery = useLensStore(state => state.addQuery);
  const setQueryResult = useLensStore(state => state.setQueryResult);
  const setQueryError = useLensStore(state => state.setQueryError);
  const setQueryRunning = useLensStore(state => state.setQueryRunning);
  
  const runQuery = async (queryId: string, code: string) => {
    if (!rayforceClient) {
      toast.error('SDK not initialized');
      return;
    }
    
    setQueryRunning(queryId, true);
    try {
      // Use execute() which handles @local/@remote directives and picks best target
      const result = await rayforceClient.execute(code);
      if (result.type === 'error') {
        setQueryError(queryId, String(result.data));
      } else {
        setQueryResult(queryId, result);
      }
    } catch (err) {
      setQueryError(queryId, (err as Error).message);
    }
  };
  
  return (
    <>
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">Queries</span>
          <button 
            className="sidebar-section-action"
            onClick={() => addQuery('New Query', "'table")}
            title="Add query"
          >
            +
          </button>
        </div>
        
        <div className="query-list">
          {queries.map(query => (
            <div
              key={query.id}
              className={`query-item ${selectedQueryId === query.id ? 'active' : ''} ${query.isRunning ? 'running' : ''}`}
              onClick={() => setSelectedQuery(query.id)}
            >
              <svg className="query-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/>
              </svg>
              <div className="query-info">
                <div className="query-name">{query.name}</div>
                <div className="query-code">{query.code}</div>
              </div>
              <div className="query-actions">
                {query.isRunning ? (
                  <span className="query-running">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="spin">
                      <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
                    </svg>
                  </span>
                ) : (
                  <button 
                    className="query-run-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      runQuery(query.id, query.code);
                    }}
                    title="Run query"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 3.5a.5.5 0 01.787-.405l7.5 5a.5.5 0 010 .81l-7.5 5A.5.5 0 014 13.5v-10z"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Widget palette icons as SVG components
const WidgetIcons = {
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  'chart-line': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 20h18" strokeLinecap="round"/>
      <path d="M3 20V4" strokeLinecap="round"/>
      <path d="M6 15l4-5 4 3 5-7" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="15" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="14" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="19" cy="6" r="1.5" fill="currentColor"/>
    </svg>
  ),
  'chart-bar': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 20h18" strokeLinecap="round"/>
      <rect x="5" y="10" width="3" height="10" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="10" y="6" width="3" height="14" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="15" y="12" width="3" height="8" rx="1" fill="currentColor" opacity="0.6"/>
    </svg>
  ),
  'chart-pie': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 3v9l6.5 6.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 12l-6.5 6.5" strokeLinecap="round"/>
    </svg>
  ),
  'chart-candle': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 4v16M12 6v12M18 3v18" strokeLinecap="round"/>
      <rect x="4" y="8" width="4" height="6" rx="0.5" fill="var(--accent-green)" stroke="var(--accent-green)"/>
      <rect x="10" y="10" width="4" height="5" rx="0.5" fill="var(--accent-red)" stroke="var(--accent-red)"/>
      <rect x="16" y="7" width="4" height="8" rx="0.5" fill="var(--accent-green)" stroke="var(--accent-green)"/>
    </svg>
  ),
  text: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h16" strokeLinecap="round"/>
      <path d="M12 6v14" strokeLinecap="round"/>
      <path d="M8 20h8" strokeLinecap="round"/>
    </svg>
  ),
  control: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/>
      <circle cx="12" cy="12" r="8"/>
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeLinecap="round"/>
    </svg>
  ),
  'query-editor': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 6l-4 6 4 6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 6l4 6-4 6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 4l-4 16" strokeLinecap="round"/>
    </svg>
  ),
};

function WidgetsPanel() {
  const widgets = [
    { type: 'grid', label: 'Data Grid' },
    { type: 'chart-line', label: 'Line Chart' },
    { type: 'chart-bar', label: 'Bar Chart' },
    { type: 'chart-pie', label: 'Pie Chart' },
    { type: 'chart-candle', label: 'Candlestick' },
    { type: 'text', label: 'Text/KPI' },
    { type: 'control', label: 'Control' },
    { type: 'query-editor', label: 'Query Editor' },
  ];
  
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header">
        <span className="sidebar-section-title">Widget Palette</span>
      </div>
      
      <div className="widget-palette">
        {widgets.map(widget => (
          <div
            key={widget.type}
            className="widget-palette-item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('widget-type', widget.type);
            }}
          >
            <span className="widget-palette-icon">
              {WidgetIcons[widget.type as keyof typeof WidgetIcons]}
            </span>
            <span className="widget-palette-label">{widget.label}</span>
          </div>
        ))}
      </div>
      
      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        Drag widgets onto the dashboard canvas to add them.
      </p>
    </div>
  );
}

function SettingsPanel() {
  const serverUrl = useLensStore(state => state.serverUrl);
  const setServerUrl = useLensStore(state => state.setServerUrl);
  
  return (
    <div className="settings-panel">
      <div className="settings-group">
        <div className="settings-group-title">Connection</div>
        <div className="settings-row">
          <label className="settings-label">Server URL</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />
        </div>
      </div>
      
      <div className="settings-group">
        <div className="settings-group-title">Refresh</div>
        <div className="settings-row">
          <label className="settings-label">Default Interval</label>
          <select defaultValue="5000">
            <option value="1000">1 second</option>
            <option value="5000">5 seconds</option>
            <option value="10000">10 seconds</option>
            <option value="30000">30 seconds</option>
            <option value="60000">1 minute</option>
            <option value="0">Manual only</option>
          </select>
        </div>
      </div>
      
      <div className="settings-group">
        <div className="settings-group-title">Rayfall Syntax</div>
        <div style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: 11, 
          color: 'var(--text-secondary)',
          background: 'var(--bg-panel)',
          padding: 12,
          borderRadius: 6,
          lineHeight: 1.6,
        }}>
          <div style={{ marginBottom: 8, color: 'var(--text-muted)' }}>;; Basic operations</div>
          <div>(count table)</div>
          <div>(key table)</div>
          <div>(at table 'column)</div>
          <div style={{ marginBottom: 8 }}>(take vector 5)</div>
          
          <div style={{ marginBottom: 8, color: 'var(--text-muted)' }}>;; Select queries</div>
          <div>(select {'{'}from: table{'}'})</div>
          <div>(select {'{'}from: table by: col{'}'})</div>
          <div>(select {'{'}cnt: (count col) from: table by: grp{'}'})</div>
          <div style={{ marginBottom: 8 }}>(select {'{'}from: table where: (== col val){'}'})</div>
          
          <div style={{ marginBottom: 8, color: 'var(--text-muted)' }}>;; Directives</div>
          <div>@local  ;; force local WASM</div>
          <div>@remote ;; force server</div>
          <div>@timeout:5000</div>
        </div>
      </div>
    </div>
  );
}
