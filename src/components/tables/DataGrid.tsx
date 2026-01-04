/**
 * DataGrid - Interactive data table
 * 
 * Displays data from loaded dataset in Rayforce - NO FAKE DATA
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRayLensStore } from '@core/store';

// Highlight rule types
export interface HighlightRule {
  id: string;
  column: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between';
  value: number;
  value2?: number;
  color: string;
  backgroundColor: string;
}

// Default highlight rules for price changes
const defaultRules: HighlightRule[] = [
  // Positive change - green
  { id: '1', column: 'change', condition: 'gt', value: 0, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  { id: '2', column: 'pct', condition: 'gt', value: 0, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  // Negative change - red
  { id: '3', column: 'change', condition: 'lt', value: 0, color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  { id: '4', column: 'pct', condition: 'lt', value: 0, color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  // Large volume - yellow highlight
  { id: '5', column: 'volume', condition: 'gt', value: 5000, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)' },
];

function evaluateRule(value: unknown, rule: HighlightRule): boolean {
  if (typeof value !== 'number') return false;
  switch (rule.condition) {
    case 'gt': return value > rule.value;
    case 'lt': return value < rule.value;
    case 'gte': return value >= rule.value;
    case 'lte': return value <= rule.value;
    case 'eq': return value === rule.value;
    case 'between': return rule.value2 !== undefined && value >= rule.value && value <= rule.value2;
    default: return false;
  }
}

function getCellStyle(value: unknown, column: string, rules: HighlightRule[]): React.CSSProperties {
  for (const rule of rules) {
    if (rule.column === column && evaluateRule(value, rule)) {
      return { color: rule.color, backgroundColor: rule.backgroundColor };
    }
  }
  return {};
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(2);
  }
  return String(value);
}

// Demo symbols and their base prices
const DEMO_SYMBOLS = [
  { sym: 'AAPL', base: 178.50 },
  { sym: 'GOOGL', base: 141.25 },
  { sym: 'MSFT', base: 378.90 },
  { sym: 'AMZN', base: 178.35 },
  { sym: 'NVDA', base: 875.40 },
  { sym: 'META', base: 505.75 },
  { sym: 'TSLA', base: 248.50 },
  { sym: 'AMD', base: 156.80 },
];

interface DataGridProps {
  tableName?: string; // Override table name, otherwise uses dataset.id
  highlightRules?: HighlightRule[];
  enableDemo?: boolean; // Enable demo mode with streaming data
}

export function DataGrid({ 
  tableName: tableNameProp,
  highlightRules = defaultRules,
  enableDemo = true,
}: DataGridProps) {
  const { bridge, status, dataset } = useRayLensStore();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showDebug, setShowDebug] = useState(false);
  const [rules] = useState<HighlightRule[]>(highlightRules);
  
  // State
  const [rfStatus, setRfStatus] = useState<'init' | 'loading' | 'ready' | 'error' | 'no-data' | 'demo'>('init');
  const [lastExpr, setLastExpr] = useState('');
  const [lastResult, setLastResult] = useState('');
  const [lastError, setLastError] = useState('');
  
  // Demo mode state
  const [demoActive, setDemoActive] = useState(false);
  const [insertCount, setInsertCount] = useState(0);
  const demoIntervalRef = useRef<number | null>(null);
  const pricesRef = useRef<Record<string, number>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Table name to query - use demo table if no dataset
  const tableName = tableNameProp ?? dataset?.id ?? (demoActive ? 'trades' : undefined);
  
  // Total row count (from Rayforce)
  const [totalRows, setTotalRows] = useState<number>(0);
  
  // Max rows to display (for performance)
  const MAX_DISPLAY_ROWS = 100; // Smaller for demo updates
  
  // Execute Rayfall expression
  const execRayfall = useCallback(async (expr: string): Promise<string | null> => {
    if (!bridge || status !== 'ready') {
      setLastError('No Rayforce bridge');
      return null;
    }
    
    setLastExpr(expr);
    try {
      const result = await bridge.eval(expr);
      const resultStr = String(result);
      setLastResult(resultStr);
      setLastError('');
      return resultStr;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setLastError(errMsg);
      setLastResult('');
      return null;
    }
  }, [bridge, status]);
  
  // Get columns from schema if available
  const schemaColumns = useMemo(() => {
    return dataset?.schema?.map(s => s.name) ?? [];
  }, [dataset?.schema]);
  
  // Query the table and load data
  const loadData = useCallback(async () => {
    if (!tableName) {
      setRfStatus('no-data');
      setLastError('No table name - import a CSV first');
      return;
    }
    
    if (!bridge || status !== 'ready') {
      setRfStatus('error');
      setLastError('Rayforce not ready');
      return;
    }
    
    setRfStatus('loading');
    
    // First verify Rayforce is working
    const testResult = await execRayfall('(+ 1 1)');
    if (testResult === null || !testResult.includes('2')) {
      setRfStatus('error');
      setLastError(`Rayforce not responding correctly: ${testResult}`);
      return;
    }
    
    // Check if table variable is defined
    const checkResult = await execRayfall(`(type ${tableName})`);
    console.log('[DataGrid] Type check:', checkResult);
    
    if (checkResult === null || checkResult.includes('error') || checkResult.includes('nil')) {
      setRfStatus('error');
      setLastError(`Table "${tableName}" not found in Rayforce. Re-import your CSV.`);
      return;
    }
    
    // Get actual row count
    const countResult = await execRayfall(`(count ${tableName})`);
    const rowCount = countResult ? parseInt(countResult.replace(/[^0-9]/g, ''), 10) : 0;
    if (!isNaN(rowCount)) {
      setTotalRows(rowCount);
      console.log(`[DataGrid] Table ${tableName} has ${rowCount} total rows`);
    }
    
    // Get columns from schema or query them
    let columnNames = schemaColumns;
    if (columnNames.length === 0) {
      // Try to get column names from table
      const colsResult = await execRayfall(`(cols ${tableName})`);
      if (colsResult) {
        // Parse column names from result like [col1 col2 col3]
        const colMatch = colsResult.match(/\[([^\]]+)\]/);
        if (colMatch && colMatch[1]) {
          columnNames = colMatch[1].split(/\s+/).filter(Boolean);
        }
      }
    }
    
    if (columnNames.length === 0) {
      setRfStatus('error');
      setLastError('Could not determine columns');
      return;
    }
    
    setColumns(columnNames);
    console.log('[DataGrid] Columns:', columnNames);
    
    // Query data column by column for reliable parsing
    const rowsToFetch = Math.min(rowCount, MAX_DISPLAY_ROWS);
    const columnData: Record<string, unknown[]> = {};
    
    for (const col of columnNames) {
      // Get column data: (at (at table 'col) (til N))
      const colExpr = rowCount > MAX_DISPLAY_ROWS
        ? `(at (at ${tableName} '${col}) (til ${rowsToFetch}))`
        : `(at ${tableName} '${col})`;
      
      const colResult = await execRayfall(colExpr);
      if (colResult) {
        // Parse vector result like [val1 val2 val3] or (val1 val2 val3)
        const vals = colResult
          .replace(/^\s*[\[(]/, '')
          .replace(/[\])]\s*$/, '')
          .split(/\s+/)
          .filter(Boolean)
          .map(v => {
            const num = Number(v);
            return isNaN(num) ? v : num;
          });
        columnData[col] = vals;
      }
    }
    
    // Convert column data to rows
    const numRows = Math.max(...Object.values(columnData).map(arr => arr.length));
    const parsedRows: Record<string, unknown>[] = [];
    
    for (let i = 0; i < numRows; i++) {
      const row: Record<string, unknown> = {};
      for (const col of columnNames) {
        row[col] = columnData[col]?.[i] ?? '';
      }
      parsedRows.push(row);
    }
    
    setData(parsedRows);
    setRfStatus('ready');
    
    console.log(`[DataGrid] Loaded ${parsedRows.length} rows, ${columnNames.length} columns`);
  }, [tableName, bridge, status, execRayfall, schemaColumns, MAX_DISPLAY_ROWS]);
  
  // Load data when dataset changes
  useEffect(() => {
    if (dataset?.id || tableNameProp) {
      loadData();
      setDemoActive(false);
    } else if (enableDemo && !demoActive) {
      // No dataset - start demo mode
      setRfStatus('no-data');
    }
  }, [dataset?.id, tableNameProp, loadData, enableDemo, demoActive]);
  
  // Start demo handler
  const startDemo = useCallback(() => {
    setDemoActive(true);
  }, []);
  
  // Demo mode: Create trades table and stream updates
  useEffect(() => {
    if (!enableDemo || !demoActive || dataset?.id || tableNameProp || !bridge || status !== 'ready') {
      return;
    }
    
    // Initialize demo
    const initDemo = async () => {
      if (!bridge) return;
      
      console.log('[DataGrid] Starting demo mode with REAL Rayforce table...');
      setRfStatus('loading');
      
      // Initialize prices
      DEMO_SYMBOLS.forEach(({ sym, base }) => {
        pricesRef.current[sym] = base;
      });
      
      try {
        // Create trades table with initial data row
        // Columns: sym (symbol), price (f64), change (f64), pct (f64), volume (i64)
        const createExpr = `(set trades (table [sym price change pct volume] (list ['INIT] [0.0] [0.0] [0.0] [0])))`;
        const createResult = await bridge.eval(createExpr);
        console.log('[DataGrid] Created trades table:', createResult);
        
        // Verify table exists
        const typeCheck = await bridge.eval('(type trades)');
        console.log('[DataGrid] Table type:', typeCheck);
        
        // Set demo columns (no timestamp column to avoid complexity)
        setColumns(['sym', 'price', 'change', 'pct', 'volume']);
        setRfStatus('demo');
        
        // Start streaming - insert real data into Rayforce
        let rowId = 0;
        
        const streamTick = async () => {
          if (!bridge) return;
          
          // Pick random symbol
          const idx = Math.floor(Math.random() * DEMO_SYMBOLS.length);
          const symbolData = DEMO_SYMBOLS[idx]!;
          const sym = symbolData.sym;
          const oldPrice = pricesRef.current[sym] ?? symbolData.base;
          
          // Random price movement (-2% to +2%)
          const changePct = (Math.random() - 0.5) * 4;
          const newPrice = Math.round(oldPrice * (1 + changePct / 100) * 100) / 100;
          const change = Math.round((newPrice - oldPrice) * 100) / 100;
          const pct = Math.round(changePct * 100) / 100;
          const volume = Math.floor(Math.random() * 10000) + 100;
          
          pricesRef.current[sym] = newPrice;
          
          // Format floats with decimal point (Rayforce is strict about types)
          const priceStr = newPrice.toFixed(2);
          const changeStr = change.toFixed(2);
          const pctStr = pct.toFixed(2);
          
          // Insert into Rayforce using IN-PLACE insert with quoted table name
          // Syntax: (insert 'tablename (list val1 val2 ...))
          const insertExpr = `(insert 'trades (list '${sym} ${priceStr} ${changeStr} ${pctStr} ${volume}))`;
          
          try {
            const insertResult = await bridge.eval(insertExpr);
            rowId++;
            setInsertCount(rowId);
            
            // Query actual data from Rayforce (last 100 rows)
            // Get count first
            const countResult = await bridge.eval('(count trades)');
            const count = parseInt(String(countResult).replace(/[^0-9]/g, ''), 10) || 0;
            setTotalRows(count);
            
            // Only refresh display every 5 inserts for performance
            if (rowId % 5 === 0 || rowId <= 20) {
              // Query last 100 rows from Rayforce
              const limit = Math.min(count, 100);
              const offset = Math.max(0, count - limit);
              
              // Get each column
              const cols = ['sym', 'price', 'change', 'pct', 'volume'];
              const columnData: Record<string, unknown[]> = {};
              
              for (const col of cols) {
                const colExpr = count > 100 
                  ? `(at (at trades '${col}) (+ ${offset} (til ${limit})))`
                  : `(at trades '${col})`;
                const colResult = await bridge.eval(colExpr);
                if (colResult) {
                  const vals = String(colResult)
                    .replace(/^\s*[\[(]/, '')
                    .replace(/[\])]\s*$/, '')
                    .split(/\s+/)
                    .filter(Boolean)
                    .map(v => {
                      const num = Number(v);
                      return isNaN(num) ? v : num;
                    });
                  columnData[col] = vals;
                }
              }
              
              // Convert to rows (reversed so newest first)
              const numRows = Math.max(...Object.values(columnData).map(arr => arr.length));
              const rows: Record<string, unknown>[] = [];
              for (let i = numRows - 1; i >= 0; i--) {
                const row: Record<string, unknown> = {};
                for (const col of cols) {
                  row[col] = columnData[col]?.[i] ?? '';
                }
                rows.push(row);
              }
              
              setData(rows);
            }
            
            setLastExpr(insertExpr);
            setLastResult(String(insertResult));
            setLastError('');
          } catch (err) {
            console.error('[DataGrid] Demo insert error:', err);
            setLastError(err instanceof Error ? err.message : 'Insert failed');
          }
        };
        
        // Stream every 500ms
        demoIntervalRef.current = window.setInterval(streamTick, 500);
        
        // Initial batch of inserts
        for (let i = 0; i < 10; i++) {
          await streamTick();
          await new Promise(r => setTimeout(r, 50)); // Small delay between initial inserts
        }
        
      } catch (err) {
        console.error('[DataGrid] Demo init error:', err);
        setRfStatus('error');
        setLastError('Failed to initialize demo: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    
    initDemo();
    
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [enableDemo, demoActive, dataset?.id, tableNameProp, bridge, status]);
  
  // Cleanup demo on unmount
  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, []);
  
  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [data, sortColumn, sortDirection]);
  
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };
  
  // Render status
  const renderStatus = () => {
    switch (rfStatus) {
      case 'init':
      case 'loading':
        return (
          <span className="text-2xs text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Loading...
          </span>
        );
      case 'ready':
        return (
          <span className="text-2xs text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {tableName}: {totalRows.toLocaleString()} rows
            {totalRows > MAX_DISPLAY_ROWS && (
              <span className="text-gray-500">(showing {Math.min(data.length, MAX_DISPLAY_ROWS).toLocaleString()})</span>
            )}
          </span>
        );
      case 'demo':
        return (
          <span className="text-2xs text-cyan-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            DEMO: trades | RF: {insertCount.toLocaleString()} inserts | {data.length} rows
            <button
              onClick={() => {
                if (demoIntervalRef.current) {
                  clearInterval(demoIntervalRef.current);
                  demoIntervalRef.current = null;
                }
                setDemoActive(false);
                setRfStatus('no-data');
                setData([]);
                setInsertCount(0);
              }}
              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-2xs"
            >
              Stop
            </button>
          </span>
        );
      case 'error':
        return (
          <span className="text-2xs text-red-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Error
          </span>
        );
      case 'no-data':
        return (
          <span className="text-2xs text-gray-500 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            No data loaded
            {enableDemo && (
              <button
                onClick={startDemo}
                className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-2xs"
              >
                Start Demo
              </button>
            )}
          </span>
        );
    }
  };
  
  return (
    <div ref={containerRef} className="h-full flex flex-col bg-gray-900 rounded overflow-hidden">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-800/50 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {renderStatus()}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={loadData}
            className="px-2 py-1 text-2xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Refresh data"
          >
            ↻
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`px-2 py-1 text-2xs rounded transition-colors ${
              showDebug ? 'bg-ray-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Debug
          </button>
        </div>
      </div>
      
      {/* Debug panel */}
      {showDebug && (
        <div className="px-2 py-2 bg-gray-800/30 border-b border-gray-700 space-y-2 max-h-48 overflow-y-auto text-2xs">
          <div>
            <span className="text-gray-500">Table:</span>
            <span className="ml-2 text-emerald-400">{tableName ?? '(none)'}</span>
          </div>
          <div>
            <span className="text-gray-500">Last Rayfall:</span>
            <code className="ml-2 text-emerald-400 break-all">{lastExpr || '(none)'}</code>
          </div>
          <div>
            <span className="text-gray-500">Result preview:</span>
            <pre className="mt-1 text-sky-400 break-all bg-gray-900 p-1 rounded max-h-20 overflow-auto">
              {lastResult ? lastResult.substring(0, 500) : '(none)'}
            </pre>
          </div>
          {lastError && (
            <div>
              <span className="text-gray-500">Error:</span>
              <code className="ml-2 text-red-400 break-all">{lastError}</code>
            </div>
          )}
        </div>
      )}
      
      {/* Empty states */}
      {rfStatus === 'no-data' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="text-3xl mb-3">📊</div>
            <div className="text-sm text-gray-400 mb-2">No Data Loaded</div>
            <div className="text-xs text-gray-600">
              Import a CSV file or load sample data
            </div>
          </div>
        </div>
      )}
      
      {rfStatus === 'error' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="text-3xl mb-3">⚠️</div>
            <div className="text-sm text-red-400 mb-2">Error Loading Data</div>
            <div className="text-xs text-gray-500 max-w-xs">{lastError}</div>
          </div>
        </div>
      )}
      
      {(rfStatus === 'init' || rfStatus === 'loading') && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="w-8 h-8 border-2 border-ray-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <div className="text-sm text-gray-400">Loading from Rayforce...</div>
          </div>
        </div>
      )}
      
      {/* Table */}
      {(rfStatus === 'ready' || rfStatus === 'demo') && data.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-800 z-10">
              <tr>
                {columns.map(col => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-2 text-left font-medium text-gray-400 cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {sortColumn === col && (
                        <svg className={`w-3 h-3 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  {columns.map(col => (
                    <td
                      key={col}
                      className="px-3 py-1.5 whitespace-nowrap transition-colors"
                      style={getCellStyle(row[col], col, rules)}
                    >
                      {formatValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
