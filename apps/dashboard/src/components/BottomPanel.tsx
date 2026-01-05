import { useState, useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useLensStore } from '../store';
import { rayforceClient } from '../App';
import { DataGridWidget } from './widgets/DataGrid';
import { logger, LogEntry, LogLevel } from '../lib/logger';
import { registerRayfallLanguage, RAYFALL_LANGUAGE_ID } from '../lib/rayfall-lang';

// Track if we've registered the language
let rayfallRegistered = false;

interface BottomPanelProps {
  height: number;
}

export function BottomPanel({ height }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'repl' | 'logs' | 'output'>('editor');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(height);
  const [isResizing, setIsResizing] = useState(false);
  const toggleBottomPanel = useLensStore(state => state.toggleBottomPanel);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  
  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: panelHeight };
    setIsResizing(true);
  }, [panelHeight]);
  
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startY - e.clientY;
      const newHeight = Math.max(100, Math.min(800, resizeRef.current.startHeight + delta));
      setPanelHeight(newHeight);
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
  
  // Handle escape to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);
  
  const currentHeight = isFullscreen ? '100vh' : isCollapsed ? 40 : panelHeight;
  
  return (
    <div 
      className={`bottom-panel ${isFullscreen ? 'panel-fullscreen' : ''} ${isCollapsed ? 'panel-collapsed' : ''}`}
      style={{ height: currentHeight }}
    >
      {/* Resize handle */}
      {!isFullscreen && !isCollapsed && (
        <div 
          className={`resize-handle resize-handle-horizontal ${isResizing ? 'active' : ''}`}
          style={{ top: 0 }}
          onMouseDown={handleResizeStart}
        />
      )}
      
      <div className="bottom-panel-header">
        <div className="bottom-panel-tabs">
          <button
            className={`bottom-panel-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => { setActiveTab('editor'); setIsCollapsed(false); }}
          >
            Query Editor
          </button>
          <button
            className={`bottom-panel-tab ${activeTab === 'repl' ? 'active' : ''}`}
            onClick={() => { setActiveTab('repl'); setIsCollapsed(false); }}
          >
            REPL
          </button>
          <button
            className={`bottom-panel-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => { setActiveTab('logs'); setIsCollapsed(false); }}
          >
            Logs
          </button>
          <button
            className={`bottom-panel-tab ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => { setActiveTab('output'); setIsCollapsed(false); }}
          >
            Output
          </button>
        </div>
        
        <div className="panel-controls">
          {/* Collapse toggle */}
          <button 
            className={`panel-control-btn ${isCollapsed ? 'active' : ''}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
          
          {/* Fullscreen toggle */}
          <button 
            className={`panel-control-btn ${isFullscreen ? 'active' : ''}`}
            onClick={() => { setIsFullscreen(!isFullscreen); setIsCollapsed(false); }}
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {isFullscreen ? '⊙' : '⛶'}
          </button>
          
          {/* Close */}
          <button 
            className="panel-control-btn" 
            onClick={toggleBottomPanel}
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="bottom-panel-content">
          {activeTab === 'editor' && <QueryEditorPanel isFullscreen={isFullscreen} />}
          {activeTab === 'repl' && <ReplPanel />}
          {activeTab === 'logs' && <ConsolePanel />}
          {activeTab === 'output' && <OutputPanel />}
        </div>
      )}
    </div>
  );
}

function QueryEditorPanel({ isFullscreen = false }: { isFullscreen?: boolean }) {
  const selectedQueryId = useLensStore(state => state.selectedQueryId);
  const selectedQuery = useLensStore(state => 
    state.workspace.queries.find(q => q.id === state.selectedQueryId)
  );
  const connectionStatus = useLensStore(state => state.connectionStatus);
  const updateQuery = useLensStore(state => state.updateQuery);
  const setQueryResult = useLensStore(state => state.setQueryResult);
  const setQueryError = useLensStore(state => state.setQueryError);
  const setQueryRunning = useLensStore(state => state.setQueryRunning);
  const activeDashboardWidgets = useLensStore(state => 
    state.workspace.dashboards.find(d => d.id === state.workspace.activeDashboardId)?.widgets || []
  );
  // Result panel width can be adjusted based on fullscreen mode
  const resultWidth = isFullscreen ? '50%' : '40%';
  
  const [localCode, setLocalCode] = useState('');
  const prevQueryIdRef = useRef(selectedQueryId);
  const runQueryRef = useRef<() => void>(() => {});
  
  // Sync local code when selection changes
  useEffect(() => {
    if (selectedQueryId !== prevQueryIdRef.current) {
      prevQueryIdRef.current = selectedQueryId;
      if (selectedQuery) {
        setLocalCode(selectedQuery.code);
      }
    }
  }, [selectedQueryId, selectedQuery]);
  
  const runQuery = useCallback(async () => {
    if (!selectedQuery || !rayforceClient) return;
    
    // Update query code first
    updateQuery(selectedQuery.id, { code: localCode });
    
    setQueryRunning(selectedQuery.id, true);
    try {
      const result = await rayforceClient.execute(localCode);
      if (result.type === 'error') {
        setQueryError(selectedQuery.id, String(result.data));
      } else {
        setQueryResult(selectedQuery.id, result);
      }
    } catch (err) {
      setQueryError(selectedQuery.id, (err as Error).message);
    }
  }, [selectedQuery, localCode, updateQuery, setQueryRunning, setQueryResult, setQueryError]);
  
  // Keep ref updated with latest runQuery
  runQueryRef.current = runQuery;
  
  const handleEditorChange = useCallback((value: string | undefined) => {
    setLocalCode(value || '');
  }, []);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  }, [runQuery]);
  
  if (!selectedQuery) {
    return (
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-muted)',
      }}>
        Select a query from the sidebar to edit
      </div>
    );
  }
  
  return (
    <div className="query-editor" onKeyDown={handleKeyDown}>
      <div className="query-editor-toolbar">
        <div className="query-editor-name">
          <input
            type="text"
            value={selectedQuery.name}
            onChange={(e) => updateQuery(selectedQuery.id, { name: e.target.value })}
          />
        </div>
        <div className="query-editor-actions">
          <select 
            style={{ marginRight: 8 }}
            title="Bind to widget"
          >
            <option value="">Bind to widget...</option>
            {activeDashboardWidgets.map(w => (
              <option key={w.id} value={w.id}>{w.title}</option>
            ))}
          </select>
          <button 
            className="btn btn-primary" 
            onClick={runQuery}
            disabled={connectionStatus !== 'connected' || selectedQuery.isRunning}
          >
            {selectedQuery.isRunning ? 'Running...' : 'Run (Ctrl+Enter)'}
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="query-editor-monaco">
          <Editor
            height="100%"
            language={RAYFALL_LANGUAGE_ID}
            theme="rayfall-dark"
            value={localCode}
            onChange={handleEditorChange}
            beforeMount={(monacoInstance) => {
              if (!rayfallRegistered) {
                registerRayfallLanguage(monacoInstance);
                rayfallRegistered = true;
              }
            }}
            onMount={(editor, monaco) => {
              // Register Ctrl+Enter to run query
              editor.addAction({
                id: 'run-query',
                label: 'Run Query',
                keybindings: [
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                ],
                run: () => {
                  // Use ref to always get latest runQuery function
                  runQueryRef.current();
                },
              });
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
              suggestOnTriggerCharacters: true,
              quickSuggestions: { other: true, strings: false, comments: false },
              acceptSuggestionOnCommitCharacter: true,
              snippetSuggestions: 'inline',
            }}
          />
        </div>
        
        <div className="query-result" style={{ width: resultWidth }}>
          <div className="query-result-header">
            Result
            {selectedQuery.lastRun && (
              <span style={{ marginLeft: 8, opacity: 0.7 }}>
                {new Date(selectedQuery.lastRun).toLocaleTimeString()}
              </span>
            )}
            {selectedQuery.lastError && (
              <span style={{ marginLeft: 8, color: 'var(--accent-red)' }}>
                Error
              </span>
            )}
          </div>
          <div className="query-result-content">
            {selectedQuery.lastError ? (
              <div style={{ padding: 16, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                {selectedQuery.lastError}
              </div>
            ) : selectedQuery.lastResult ? (
              <DataGridWidget data={selectedQuery.lastResult} />
            ) : (
              <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                Run the query to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConsolePanel() {
  const [logs, setLogs] = useState<LogEntry[]>(() => logger.getLogs());
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to new logs
  useEffect(() => {
    const unsubscribe = logger.subscribe((entry) => {
      setLogs(prev => [...prev.slice(-999), entry]);
    });
    return unsubscribe;
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (sourceFilter && !log.source.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
    return true;
  });

  const levelColors: Record<LogLevel, string> = {
    debug: 'var(--text-muted)',
    info: 'var(--accent-blue)',
    warn: 'var(--accent-amber)',
    error: 'var(--accent-red)',
  };

  const levelIcons: Record<LogLevel, string> = {
    debug: '○',
    info: '●',
    warn: '⚠',
    error: '✕',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px', 
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
        fontSize: 12,
      }}>
        <select 
          value={filter} 
          onChange={e => setFilter(e.target.value as LogLevel | 'all')}
          style={{ padding: '4px 8px', fontSize: 11 }}
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <input
          type="text"
          placeholder="Filter by source..."
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          style={{ width: 150, padding: '4px 8px', fontSize: 11 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)' }}>{filteredLogs.length} entries</span>
        <button 
          onClick={() => { logger.clear(); setLogs([]); }}
          style={{ 
            padding: '4px 8px', 
            background: 'transparent', 
            border: '1px solid var(--border-strong)',
            color: 'var(--text-secondary)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflow: 'auto', 
          fontFamily: 'var(--font-mono)', 
          fontSize: 12,
          background: 'var(--bg-panel)',
        }}
      >
        {filteredLogs.map((log) => (
          <div 
            key={log.id} 
            style={{ 
              padding: '4px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ 
              color: levelColors[log.level], 
              width: 16,
              textAlign: 'center',
            }}>
              {levelIcons[log.level]}
            </span>
            <span style={{ 
              color: 'var(--text-muted)', 
              width: 80,
              flexShrink: 0,
            }}>
              {log.timestamp.toLocaleTimeString()}
            </span>
            <span style={{ 
              color: 'var(--accent-purple)', 
              width: 80,
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {log.source}
            </span>
            <span style={{ 
              color: log.level === 'error' ? 'var(--accent-red)' : 
                     log.level === 'warn' ? 'var(--accent-amber)' : 'var(--text-primary)',
              flex: 1,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {log.message}
            </span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>
            No logs to display
          </div>
        )}
      </div>
    </div>
  );
}

function ReplPanel() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Array<{ 
    type: 'input' | 'output' | 'error'; 
    text: string; 
    source?: 'local' | 'remote';
    time?: number;
  }>>([]);
  const connectionStatus = useLensStore(state => state.connectionStatus);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const execute = async () => {
    if (!input.trim() || !rayforceClient) return;
    
    setHistory(h => [...h, { type: 'input', text: input }]);
    
    try {
      // Use the new execute method which handles @local/@remote directives
      const result = await rayforceClient.execute(input);
      
      let output: string;
      if (result.type === 'table' && Array.isArray(result.data)) {
        output = `Table: ${result.rowCount} rows, ${result.columns?.length} columns\n`;
        output += JSON.stringify(result.data.slice(0, 10), null, 2);
        if ((result.data as unknown[]).length > 10) {
          output += `\n... and ${(result.data as unknown[]).length - 10} more rows`;
        }
      } else if (result.type === 'error') {
        setHistory(h => [...h, { 
          type: 'error', 
          text: String(result.data),
          source: result.source,
          time: result.executionTime,
        }]);
        setInput('');
        return;
      } else {
        output = typeof result.data === 'object' 
          ? JSON.stringify(result.data, null, 2) 
          : String(result.data);
      }
      
      setHistory(h => [...h, { 
        type: 'output', 
        text: output,
        source: result.source,
        time: result.executionTime,
      }]);
    } catch (err) {
      setHistory(h => [...h, { type: 'error', text: (err as Error).message }]);
    }
    
    setInput('');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: 12, 
          fontFamily: 'var(--font-mono)', 
          fontSize: 13,
          background: 'var(--bg-panel)',
        }}
      >
        <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 11 }}>
          Rayfall REPL • Use @local or @remote to force execution target • Connected: {connectionStatus}
        </div>
        {history.map((item, i) => (
          <div key={i} style={{ 
            marginBottom: 8,
            color: item.type === 'error' ? 'var(--accent-red)' : 
                   item.type === 'input' ? 'var(--accent-blue)' : 'var(--text-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ opacity: 0.5 }}>{item.type === 'input' ? '>' : '<'}</span>
              {item.source && (
                <span style={{ 
                  fontSize: 10, 
                  padding: '1px 4px', 
                  background: item.source === 'local' ? 'var(--accent-purple)' : 'var(--accent-green)',
                  color: '#fff',
                  borderRadius: 3,
                }}>
                  {item.source}
                </span>
              )}
              {item.time !== undefined && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {item.time.toFixed(1)}ms
                </span>
              )}
            </div>
            <pre style={{ 
              margin: '4px 0 0 16px', 
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-mono)',
            }}>
              {item.text}
            </pre>
          </div>
        ))}
      </div>
      <div style={{ 
        display: 'flex', 
        padding: 8, 
        borderTop: '1px solid var(--border-subtle)',
        gap: 8,
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && execute()}
          placeholder="Enter Rayfall expression... (e.g., (count trades), @local (+ 1 2))"
          style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
          disabled={!rayforceClient}
        />
        <button 
          className="btn btn-primary" 
          onClick={execute}
          disabled={!rayforceClient}
        >
          Execute
        </button>
      </div>
    </div>
  );
}

function OutputPanel() {
  const selectedQuery = useLensStore(state => 
    state.workspace.queries.find(q => q.id === state.selectedQueryId)
  );
  
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {selectedQuery?.lastResult ? (
        <pre style={{ 
          padding: 16, 
          margin: 0, 
          fontFamily: 'var(--font-mono)', 
          fontSize: 12,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
        }}>
          {JSON.stringify(selectedQuery.lastResult, null, 2)}
        </pre>
      ) : (
        <div style={{ padding: 16, color: 'var(--text-muted)' }}>
          No output
        </div>
      )}
    </div>
  );
}
