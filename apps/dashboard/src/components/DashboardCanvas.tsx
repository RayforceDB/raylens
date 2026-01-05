import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useLensStore, Widget as WidgetType } from '../store';
import { shallow } from 'zustand/shallow';
import { DataGridWidget, paginateQuery, countQuery } from './widgets/DataGrid';
import { ChartWidget } from './widgets/Chart';
import { TextWidget } from './widgets/Text';
import { WidgetConfigModal } from './WidgetConfigModal';
import { rayforceClient } from '../App';

export function DashboardCanvas() {
  const selectedWidgetId = useLensStore(state => state.selectedWidgetId);
  const setSelectedWidget = useLensStore(state => state.setSelectedWidget);
  const addWidget = useLensStore(state => state.addWidget);
  const setQueryResult = useLensStore(state => state.setQueryResult);
  const setQueryError = useLensStore(state => state.setQueryError);
  const setQueryRunning = useLensStore(state => state.setQueryRunning);
  const connectionStatus = useLensStore(state => state.connectionStatus);

  const activeDashboard = useLensStore(state =>
    state.workspace.dashboards.find(d => d.id === state.workspace.activeDashboardId)
  );
  const queries = useLensStore(state => state.workspace.queries);

  // Run auto-run queries once on mount - deduplicated by query ID
  const [queriesInitialized, setQueriesInitialized] = useState(false);

  useEffect(() => {
    // Wait for connection to be established before running auto-run queries
    if (!rayforceClient || queriesInitialized || connectionStatus !== 'connected') return;
    
    // Collect unique query IDs that need auto-run
    const autoRunQueryIds = new Set<string>();
    for (const widget of activeDashboard?.widgets || []) {
      if (widget.binding?.autoRun && widget.binding.queryId) {
        autoRunQueryIds.add(widget.binding.queryId);
      }
    }
    
    // Run each unique query once
    const runQueries = async () => {
      for (const queryId of autoRunQueryIds) {
        const query = queries.find(q => q.id === queryId);
        if (query && !query.lastResult) {
          console.log(`[DashboardCanvas] Running query "${query.name}" (${queryId.slice(0,8)}): ${query.code}`);
          setQueryRunning(query.id, true);
          try {
            const result = await rayforceClient!.execute(query.code);
            console.log(`[DashboardCanvas] Query "${query.name}" result:`, result.type, result.type === 'error' ? result.data : '');
            if (result.type === 'error') {
              setQueryError(query.id, String(result.data));
            } else {
              setQueryResult(query.id, result);
            }
          } catch (err) {
            console.error(`[DashboardCanvas] Query "${query.name}" error:`, err);
            setQueryError(query.id, (err as Error).message);
          }
        }
      }
      setQueriesInitialized(true);
    };
    
    runQueries();
  }, [queriesInitialized, connectionStatus]);
  
  // Set up refresh intervals - deduplicated by query ID
  useEffect(() => {
    // Wait for connection before setting up refresh intervals
    if (!rayforceClient || !activeDashboard || connectionStatus !== 'connected') return;

    // Collect all queries that need refresh and find shortest interval for each
    const queryIntervals = new Map<string, number>();

    for (const widget of activeDashboard.widgets) {
      if (widget.binding?.refreshInterval && widget.binding.refreshInterval > 0 && widget.binding.queryId) {
        const existingInterval = queryIntervals.get(widget.binding.queryId);
        if (existingInterval === undefined || widget.binding.refreshInterval < existingInterval) {
          queryIntervals.set(widget.binding.queryId, widget.binding.refreshInterval);
        }
      }
    }

    // Create one interval per unique query
    const intervals: ReturnType<typeof setInterval>[] = [];

    queryIntervals.forEach((intervalMs, queryId) => {
      const interval = setInterval(async () => {
        // Check connection status at execution time
        const currentStatus = useLensStore.getState().connectionStatus;
        if (currentStatus !== 'connected') return;

        // Check if any widget using this query is paused
        const state = useLensStore.getState();
        const dashboard = state.workspace.dashboards.find(d => d.id === state.workspace.activeDashboardId);
        const widgetUsingQuery = dashboard?.widgets.find(w => w.binding?.queryId === queryId);
        if (widgetUsingQuery?.config?.paused) return;

        // Get fresh query data from store at execution time
        const currentQuery = state.workspace.queries.find(q => q.id === queryId);
        if (!currentQuery) return;

        setQueryRunning(queryId, true);
        try {
          const result = await rayforceClient!.execute(currentQuery.code);
          if (result.type === 'error') {
            setQueryError(queryId, String(result.data));
          } else {
            setQueryResult(queryId, result);
          }
        } catch (err) {
          setQueryError(queryId, (err as Error).message);
        }
      }, intervalMs);

      intervals.push(interval);
    });

    return () => {
      intervals.forEach(clearInterval);
    };
  }, [activeDashboard?.id, connectionStatus]); // Re-setup intervals when dashboard or connection changes

  const gridRef = useRef<HTMLDivElement>(null);
  const appMode = useLensStore(state => state.appMode);
  const isDevMode = appMode === 'dev';

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const widgetType = e.dataTransfer.getData('widget-type');
    if (!widgetType || !activeDashboard) return;

    const type = widgetType.startsWith('chart-') ? 'chart' : widgetType as WidgetType['type'];
    const chartType = widgetType.startsWith('chart-') ? widgetType.replace('chart-', '') : undefined;

    // Calculate grid position from drop location
    let x = 0, y = 0;
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;

      // Grid: 12 columns with 12px gap, rows are 60px with 12px gap
      const gap = 12;
      const cellWidth = (rect.width - gap * 11) / 12;
      const cellHeight = 60;

      x = Math.max(0, Math.min(8, Math.floor(dropX / (cellWidth + gap)))); // Max x=8 for w=4 widget
      y = Math.max(0, Math.floor(dropY / (cellHeight + gap)));
    }

    addWidget(activeDashboard.id, {
      type,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      config: chartType ? { chartType } : {},
      position: { x, y, w: 4, h: 4 },
    });
  }, [activeDashboard, addWidget]);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  if (!activeDashboard) {
    return (
      <div className="dashboard-canvas">
        <div className="dashboard-empty">
          <h3>No dashboard selected</h3>
          <p>Create a new dashboard to get started.</p>
        </div>
      </div>
    );
  }
  
  if (activeDashboard.widgets.length === 0) {
    return (
      <div
        className="dashboard-canvas"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="dashboard-empty">
          <svg className="dashboard-empty-icon" viewBox="0 0 64 64" fill="currentColor">
            <rect x="4" y="4" width="24" height="24" rx="4" opacity="0.5" />
            <rect x="36" y="4" width="24" height="24" rx="4" opacity="0.3" />
            <rect x="4" y="36" width="24" height="24" rx="4" opacity="0.3" />
            <rect x="36" y="36" width="24" height="24" rx="4" opacity="0.5" />
          </svg>
          <h3>Empty Dashboard</h3>
          <p>Drag widgets from the sidebar or click "Add Widget" to start building your dashboard.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className="dashboard-canvas"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => setSelectedWidget(null)}
    >
      <div ref={gridRef} className="dashboard-grid">
        {activeDashboard.widgets.map(widget => (
          <WidgetWrapper
            key={widget.id}
            widget={widget}
            isSelected={selectedWidgetId === widget.id}
            onSelect={() => setSelectedWidget(widget.id)}
            isDevMode={isDevMode}
          />
        ))}
      </div>
    </div>
  );
}

interface WidgetWrapperProps {
  widget: WidgetType;
  isSelected: boolean;
  onSelect: () => void;
  isDevMode: boolean;
}

function WidgetWrapper({ widget, isSelected, onSelect, isDevMode }: WidgetWrapperProps) {
  const deleteWidget = useLensStore(state => state.deleteWidget);
  const updateWidget = useLensStore(state => state.updateWidget);
  const activeDashboardId = useLensStore(state => state.workspace.activeDashboardId);
  const [showConfig, setShowConfig] = useState(false);
  const [pageData, setPageData] = useState<unknown>(null);
  const [totalRows, setTotalRows] = useState<number | undefined>(undefined);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [localSize, setLocalSize] = useState({ w: widget.position.w, h: widget.position.h });
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; elemX: number; elemY: number; elemW: number; elemH: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const isPaused = widget.config?.paused === true;

  const togglePause = useCallback(() => {
    if (!activeDashboardId) return;
    updateWidget(activeDashboardId, widget.id, {
      config: { ...widget.config, paused: !isPaused }
    });
  }, [activeDashboardId, widget.id, widget.config, isPaused, updateWidget]);

  // Get bound query data - extract specific fields to prevent unnecessary re-renders
  const boundQueryId = widget.binding?.queryId;
  
  // Select only the specific query's data we need
  const boundQueryData = useLensStore(
    useCallback(
      (state) => {
        if (!boundQueryId) return null;
        const query = state.workspace.queries.find(q => q.id === boundQueryId);
        if (!query) {
          console.warn(`[Widget "${widget.title}"] Query not found: ${boundQueryId}`);
          return null;
        }
        // Return only the fields we need to minimize re-renders
        return {
          id: query.id,
          name: query.name,
          code: query.code,
          isRunning: query.isRunning,
          lastResult: query.lastResult,
          lastError: query.lastError,
        };
      },
      [boundQueryId, widget.title]
    ),
    shallow // Use shallow equality comparison
  );
  
  // Memoize to create stable reference
  const boundQuery = useMemo(() => {
    if (boundQueryData) {
      console.log(`[Widget "${widget.title}"] Bound to query "${boundQueryData.name}" (${boundQueryData.id.slice(0,8)})`);
    }
    return boundQueryData;
  }, [boundQueryData, widget.title]);
  
  // Check if query is a simple table reference for pagination
  const isSimpleTableQuery = useCallback((code: string): string | null => {
    // Match patterns like: trades, 'trades, `trades, (trades)
    const trimmed = code.trim();
    const tableMatch = trimmed.match(/^[`']?(\w+)[`']?$/) || 
                       trimmed.match(/^\([`']?(\w+)[`']?\)$/);
    return tableMatch ? tableMatch[1] : null;
  }, []);
  
  // Handle pagination request
  const handlePageRequest = useCallback(async (start: number, end: number) => {
    if (!boundQuery || !rayforceClient) return;
    
    const tableName = isSimpleTableQuery(boundQuery.code);
    if (!tableName) return;
    
    try {
      // Fetch page data using Rayfall indexing
      const pageQuery = paginateQuery(tableName, start, end);
      const result = await rayforceClient.execute(pageQuery);
      
      if (result.type !== 'error') {
        setPageData(result);
        
        // Also get total count if we don't have it
        if (totalRows === undefined) {
          const countResult = await rayforceClient.execute(countQuery(tableName));
          if (countResult.type === 'scalar' && typeof countResult.data === 'number') {
            setTotalRows(countResult.data);
          }
        }
      }
    } catch (err) {
      console.error('[Widget] Page request failed:', err);
    }
  }, [boundQuery, isSimpleTableQuery, totalRows]);
  
  // Clear pagination state when query binding changes
  useEffect(() => {
    setPageData(null);
    setTotalRows(undefined);
  }, [widget.binding?.queryId]);
  
  // Initialize total row count for simple table queries
  useEffect(() => {
    if (!boundQuery || !rayforceClient) return;
    
    const tableName = isSimpleTableQuery(boundQuery.code);
    if (tableName && totalRows === undefined) {
      rayforceClient.execute(countQuery(tableName)).then(result => {
        if (result.type === 'scalar' && typeof result.data === 'number') {
          setTotalRows(result.data);
        }
      });
    }
  }, [boundQuery, isSimpleTableQuery, totalRows]);
  
  // Handle widget resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!isDevMode) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { 
      startX: e.clientX, 
      startY: e.clientY, 
      startW: localSize.w, 
      startH: localSize.h 
    };
    setIsResizing(true);
  }, [isDevMode, localSize]);
  
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      // Each grid unit is roughly 80px
      const gridUnit = 80;
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;
      const newW = Math.max(2, Math.min(12, resizeRef.current.startW + Math.round(deltaX / gridUnit)));
      const newH = Math.max(2, Math.min(12, resizeRef.current.startH + Math.round(deltaY / gridUnit)));
      setLocalSize({ w: newW, h: newH });
    };
    
    const handleMouseUp = () => {
      if (activeDashboardId && (localSize.w !== widget.position.w || localSize.h !== widget.position.h)) {
        updateWidget(activeDashboardId, widget.id, {
          position: { ...widget.position, w: localSize.w, h: localSize.h }
        });
      }
      setIsResizing(false);
      resizeRef.current = null;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, localSize, widget, activeDashboardId, updateWidget]);
  
  // Sync local size with widget position when widget changes externally
  useEffect(() => {
    setLocalSize({ w: widget.position.w, h: widget.position.h });
  }, [widget.position.w, widget.position.h]);

  // Manual drag handlers - use position:fixed during drag
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!isDevMode || !widgetRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = widgetRef.current.getBoundingClientRect();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elemX: rect.left,
      elemY: rect.top,
      elemW: rect.width,
      elemH: rect.height,
    };
    setDragPos({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    setIsDragging(true);
  }, [isDevMode]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;
      setDragPos({
        x: dragStartRef.current.elemX + deltaX,
        y: dragStartRef.current.elemY + deltaY,
        w: dragStartRef.current.elemW,
        h: dragStartRef.current.elemH,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragStartRef.current || !activeDashboardId) {
        setDragPos(null);
        setIsDragging(false);
        dragStartRef.current = null;
        return;
      }

      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      // Calculate grid cell size (12 columns, 60px rows, 12px gap)
      const gap = 12;
      const gridContainer = document.querySelector('.dashboard-grid');
      if (gridContainer) {
        const rect = gridContainer.getBoundingClientRect();
        const cellWidth = (rect.width - gap * 11) / 12;
        const cellHeight = 60;

        const deltaGridX = Math.round(deltaX / (cellWidth + gap));
        const deltaGridY = Math.round(deltaY / (cellHeight + gap));

        if (deltaGridX !== 0 || deltaGridY !== 0) {
          const newX = Math.max(0, Math.min(12 - widget.position.w, widget.position.x + deltaGridX));
          const newY = Math.max(0, widget.position.y + deltaGridY);
          updateWidget(activeDashboardId, widget.id, {
            position: { ...widget.position, x: newX, y: newY }
          });
        }
      }

      setDragPos(null);
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, activeDashboardId, widget, updateWidget]);

  // Widget style - use fixed position during drag
  const style: React.CSSProperties = isDragging && dragPos ? {
    position: 'fixed',
    left: dragPos.x,
    top: dragPos.y,
    width: dragPos.w,
    height: dragPos.h,
    zIndex: 1000,
    cursor: 'grabbing',
    boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
  } : {
    gridColumnStart: widget.position.x + 1,
    gridColumnEnd: `span ${localSize.w}`,
    gridRowStart: widget.position.y + 1,
    gridRowEnd: `span ${localSize.h}`,
  };
  
  // Use page data if available, otherwise use bound query result
  const gridData = pageData || boundQuery?.lastResult;
  const isServerSidePagination = boundQuery ? isSimpleTableQuery(boundQuery.code) !== null : false;

  // Inject totalRows into result for server-side pagination
  const dataWithRowCount = gridData && totalRows !== undefined ? {
    ...gridData as object,
    rowCount: totalRows,
  } : gridData;

  // Calculate grid dimensions for display in header
  const gridDimensions = useMemo(() => {
    if (widget.type !== 'grid' || !boundQuery?.lastResult) return null;

    const result = boundQuery.lastResult as { type?: string; columns?: string[]; toJS?: () => unknown; data?: unknown };
    let rows = 0;
    let cols = 0;

    if (result.type === 'table' && result.columns) {
      cols = result.columns.length;
      const jsData = result.toJS?.();
      rows = Array.isArray(jsData) ? jsData.length : 0;
    } else if (result.type === 'vector') {
      cols = 1;
      const arr = result.toJS?.() || result.data;
      rows = Array.isArray(arr) ? arr.length : 0;
    } else if (Array.isArray(result.data)) {
      rows = result.data.length;
      cols = result.data.length > 0 && typeof result.data[0] === 'object'
        ? Object.keys(result.data[0] as object).length
        : 1;
    }

    // Use totalRows if available (server-side pagination)
    if (totalRows !== undefined) rows = totalRows;

    return rows > 0 || cols > 0 ? { rows, cols } : null;
  }, [widget.type, boundQuery?.lastResult, totalRows]);
  
  const renderWidget = () => {
    // Show error if query failed
    if (boundQuery?.lastError) {
      // Strip ANSI escape codes
      const cleanError = boundQuery.lastError.replace(/\x1b\[[0-9;]*m/g, '').trim();
      
      // Parse error: extract main message and details
      const lines = cleanError.split('\n');
      const errorLine = lines.find(l => l.includes('Error:') || l.includes('error:')) || lines[0];
      const mainError = errorLine?.replace(/^[×x]\s*/, '').replace(/Error:\s*/i, '').trim() || 'Query failed';
      
      // Find the "not found" or specific error
      const detailLine = lines.find(l => l.includes('not found') || l.includes('├─') || l.includes('│'));
      const detail = detailLine?.replace(/[├│└─×]\s*/g, '').trim();
      
      return (
        <div className="widget-error">
          <div className="error-header">
            <svg className="error-icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z"/>
            </svg>
            <span>{mainError}{detail ? `: ${detail}` : ''}</span>
          </div>
          <div className="error-content">
            <pre className="error-message">{cleanError}</pre>
          </div>
        </div>
      );
    }
    
    switch (widget.type) {
      case 'grid':
        return (
          <DataGridWidget 
            data={dataWithRowCount} 
            config={{
              // Merge widget config with pagination settings
              ...widget.config,
              enablePagination: true,
              defaultPageSize: 100,
              serverSidePagination: isServerSidePagination,
            }}
            onPageRequest={isServerSidePagination ? handlePageRequest : undefined}
          />
        );
      case 'chart':
        return (
          <ChartWidget 
            data={boundQuery?.lastResult} 
            chartType={(widget.config.chartType as string) || 'line'} 
          />
        );
      case 'text':
        return <TextWidget data={boundQuery?.lastResult} config={widget.config} />;
      default:
        return <div style={{ padding: 16, color: 'var(--text-muted)' }}>Unknown widget type</div>;
    }
  };
  
  return (
    <div
      ref={widgetRef}
      className={`widget ${isSelected && isDevMode ? 'selected' : ''} ${isDevMode ? '' : 'live-mode'} ${isDragging ? 'dragging' : ''}`}
      style={style}
      onClick={(e) => {
        if (!isDevMode) return;
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Widget header - minimal in live mode, draggable in dev mode */}
      <div
        className={`widget-header ${isDevMode ? '' : 'live-mode'} ${isDragging ? 'dragging' : ''}`}
        onMouseDown={isDevMode ? handleDragStart : undefined}
      >
        <div className="widget-title-row">
          <span className="widget-title">{widget.title}</span>
          {gridDimensions && (
            <span className="widget-dimensions">
              {gridDimensions.rows.toLocaleString()} rows x {gridDimensions.cols} cols
            </span>
          )}
        </div>
        
        {isDevMode ? (
          <div className="widget-actions">
            {boundQuery && (
              <span className="widget-query-info">
                <span className={`query-status ${boundQuery.isRunning ? 'running' : 'idle'}`}>
                  {boundQuery.isRunning ? (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="spin">
                      <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="8" cy="8" r="3"/>
                    </svg>
                  )}
                </span>
                {boundQuery.name}
                {widget.binding?.refreshInterval ? ` (${widget.binding.refreshInterval / 1000}s)` : ''}
              </span>
            )}
            {widget.binding?.refreshInterval && widget.binding.refreshInterval > 0 && (
              <button
                className={`widget-action widget-pause-toggle ${isPaused ? 'paused' : ''}`}
                title={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePause();
                }}
              >
                {isPaused ? (
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                )}
              </button>
            )}
            <button
              className="widget-action"
              title="Configure"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfig(true);
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
              </svg>
            </button>
            <button 
              className="widget-action"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                if (activeDashboardId) {
                  deleteWidget(activeDashboardId, widget.id);
                }
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        ) : (
          // Live mode: show only refresh indicator
          boundQuery?.isRunning && (
            <span className="widget-refresh-indicator">
              <svg viewBox="0 0 16 16" fill="currentColor" className="spin">
                <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
              </svg>
            </span>
          )
        )}
      </div>
      
      <div className="widget-body">
        {renderWidget()}
      </div>
      
      {/* Resize handle - only in dev mode */}
      {isDevMode && (
        <div 
          className={`widget-resize-handle ${isResizing ? 'active' : ''}`}
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 14v-2h-2v2h2zm0-4v-2h-2v2h2zm-4 4v-2H8v2h2zm0-4v-2H8v2h2zm-4 4v-2H4v2h2z"/>
          </svg>
        </div>
      )}
      
      {isDevMode && showConfig && activeDashboardId && (
        <WidgetConfigModal
          widget={widget}
          dashboardId={activeDashboardId}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
