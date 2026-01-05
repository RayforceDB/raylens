import { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellClassParams, ValueFormatterParams, ICellRendererParams, GetRowIdParams, IHeaderParams } from 'ag-grid-community';
import type { RayforceResult } from '../../lib/rayforce';

// ============================================================================
// CUSTOM HEADER COMPONENT - Shows column name and type
// ============================================================================

interface CustomHeaderProps extends IHeaderParams {
  columnType?: string;
}

function CustomHeader(props: CustomHeaderProps) {
  const { displayName, columnType, enableSorting, setSort } = props;
  const [sortState, setSortState] = useState<'asc' | 'desc' | null>(null);
  
  const handleSort = () => {
    if (!enableSorting) return;
    
    let newSort: 'asc' | 'desc' | null = null;
    if (sortState === null) newSort = 'asc';
    else if (sortState === 'asc') newSort = 'desc';
    else newSort = null;
    
    setSortState(newSort);
    setSort(newSort, false);
  };
  
  return (
    <div 
      className="custom-header"
      onClick={handleSort}
      style={{ cursor: enableSorting ? 'pointer' : 'default' }}
    >
      <div className="custom-header-content">
        <span className="custom-header-name">{displayName}</span>
        {columnType && (
          <span className="custom-header-type">{columnType}</span>
        )}
      </div>
      {sortState && (
        <span className="custom-header-sort">
          {sortState === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// CELL STYLING CONFIGURATION
// ============================================================================

export interface CellColorRule {
  column?: string;  // Column name to apply to (or '*' for all)
  condition: 'positive' | 'negative' | 'zero' | 'equals' | 'contains' | 'regex' | 'range' | 'flash';
  value?: unknown;  // For equals/contains/regex
  min?: number;     // For range
  max?: number;     // For range
  style: {
    color?: string;
    background?: string;
    fontWeight?: string;
  };
}

// Default color rules - empty by default, user can configure via Widget Config
const DEFAULT_COLOR_RULES: CellColorRule[] = [];


// ============================================================================
// CELL RENDERERS
// ============================================================================

function SparklineRenderer({ value }: ICellRendererParams) {
  if (!Array.isArray(value) || value.length < 2) return null;
  
  const min = Math.min(...value);
  const max = Math.max(...value);
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  
  const points = value.map((v, i) => {
    const x = (i / (value.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const isUp = value[value.length - 1] >= value[0];
  
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
      {value.map((v, i) => {
        const x = (i / (value.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return <circle key={i} cx={x} cy={y} r="2" fill={isUp ? '#22c55e' : '#ef4444'} />;
      })}
    </svg>
  );
}

function FlagRenderer({ value }: ICellRendererParams) {
  const flagMap: Record<string, string> = {
    'EUR': '🇪🇺', 'GBP': '🇬🇧', 'USD': '🇺🇸', 'JPY': '🇯🇵', 'CAD': '🇨🇦',
    'AUD': '🇦🇺', 'HKD': '🇭🇰', 'NZD': '🇳🇿', 'CNY': '🇨🇳', 'INR': '🇮🇳',
    'RUB': '🇷🇺', 'CHF': '🇨🇭', 'SGD': '🇸🇬', 'KRW': '🇰🇷', 'BRL': '🇧🇷',
  };
  
  const str = String(value || '');
  const currency = str.substring(0, 3);
  const flag = flagMap[currency] || flagMap[str];
  
  return flag ? <span style={{ marginRight: 6 }}>{flag} {value}</span> : <span>{value}</span>;
}

// Badge colors for common trading values - pill style with gradients
const BADGE_COLORS: Record<string, {
  gradient: string;
  text: string;
  glow: string;
  border?: string;
}> = {
  // Buy/Sell - vibrant pill style
  'BUY': {
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    text: '#ffffff',
    glow: 'rgba(34, 197, 94, 0.4)',
    border: 'rgba(74, 222, 128, 0.3)',
  },
  'SELL': {
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    text: '#ffffff',
    glow: 'rgba(239, 68, 68, 0.4)',
    border: 'rgba(248, 113, 113, 0.3)',
  },
  'B': {
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    text: '#ffffff',
    glow: 'rgba(34, 197, 94, 0.4)',
    border: 'rgba(74, 222, 128, 0.3)',
  },
  'S': {
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    text: '#ffffff',
    glow: 'rgba(239, 68, 68, 0.4)',
    border: 'rgba(248, 113, 113, 0.3)',
  },
  // Order status
  'FILLED': {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    text: '#ffffff',
    glow: 'rgba(59, 130, 246, 0.35)',
    border: 'rgba(96, 165, 250, 0.3)',
  },
  'PARTIAL': {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    text: '#ffffff',
    glow: 'rgba(245, 158, 11, 0.35)',
    border: 'rgba(251, 191, 36, 0.3)',
  },
  'PENDING': {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    text: '#ffffff',
    glow: 'rgba(245, 158, 11, 0.35)',
    border: 'rgba(251, 191, 36, 0.3)',
  },
  'NEW': {
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    text: '#ffffff',
    glow: 'rgba(6, 182, 212, 0.35)',
    border: 'rgba(34, 211, 238, 0.3)',
  },
  'OPEN': {
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    text: '#ffffff',
    glow: 'rgba(6, 182, 212, 0.35)',
    border: 'rgba(34, 211, 238, 0.3)',
  },
  'CANCELLED': {
    gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    text: '#e5e7eb',
    glow: 'rgba(107, 114, 128, 0.3)',
    border: 'rgba(156, 163, 175, 0.3)',
  },
  'REJECTED': {
    gradient: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)',
    text: '#fca5a5',
    glow: 'rgba(153, 27, 27, 0.35)',
    border: 'rgba(252, 165, 165, 0.2)',
  },
  'ACTIVE': {
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    text: '#ffffff',
    glow: 'rgba(34, 197, 94, 0.4)',
    border: 'rgba(74, 222, 128, 0.3)',
  },
  // Order types
  'MARKET': {
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    text: '#ffffff',
    glow: 'rgba(139, 92, 246, 0.35)',
    border: 'rgba(167, 139, 250, 0.3)',
  },
  'LIMIT': {
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    text: '#ffffff',
    glow: 'rgba(14, 165, 233, 0.35)',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  'STOP': {
    gradient: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
    text: '#ffffff',
    glow: 'rgba(234, 179, 8, 0.35)',
    border: 'rgba(250, 204, 21, 0.3)',
  },
};

function BadgeRenderer({ value }: ICellRendererParams) {
  const strVal = String(value || '').toUpperCase();
  const colors = BADGE_COLORS[strVal];

  if (colors) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.3px',
        background: colors.gradient,
        color: colors.text,
        textTransform: 'uppercase',
        boxShadow: `0 1px 4px ${colors.glow}`,
        textShadow: '0 1px 1px rgba(0,0,0,0.2)',
      }}>
        {value}
      </span>
    );
  }

  return <span>{value}</span>;
}

function PriceRenderer({ value, data, colDef }: ICellRendererParams) {
  const numVal = Number(value);
  
  const formatted = !isNaN(numVal) 
    ? numVal.toLocaleString(undefined, { 
        minimumFractionDigits: 2,
        maximumFractionDigits: numVal < 10 ? 4 : 2 
      })
    : value;
  
  const prev = data?._prev?.[colDef?.field || ''];
  let bgColor = 'transparent';
  let textColor = 'inherit';
  
  if (prev !== undefined && prev !== numVal) {
    bgColor = numVal > prev ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    textColor = numVal > prev ? '#22c55e' : '#ef4444';
  }
  
  return (
    <span style={{ 
      background: bgColor, color: textColor,
      padding: '2px 6px', borderRadius: 3,
      fontFamily: 'var(--font-mono)', fontWeight: 500,
    }}>
      {formatted}
    </span>
  );
}

// ============================================================================
// PAGINATION COMPONENT
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

function Pagination({ currentPage, totalRows, pageSize, onPageChange, onPageSizeChange, isLoading }: PaginationProps) {
  const totalPages = Math.ceil(totalRows / pageSize);
  const startRow = currentPage * pageSize + 1;
  const endRow = Math.min((currentPage + 1) * pageSize, totalRows);
  
  const pageSizes = [25, 50, 100, 250, 500, 1000];
  
  return (
    <div className="grid-pagination">
      <div className="pagination-info">
        {totalRows > 0 ? (
          <>
            Showing <strong>{startRow.toLocaleString()}</strong> - <strong>{endRow.toLocaleString()}</strong> of <strong>{totalRows.toLocaleString()}</strong> rows
          </>
        ) : (
          'No rows'
        )}
        {isLoading && <span className="pagination-loading">Loading...</span>}
      </div>
      
      <div className="pagination-controls">
        <select 
          value={pageSize} 
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="pagination-size"
        >
          {pageSizes.map(size => (
            <option key={size} value={size}>{size} rows</option>
          ))}
        </select>
        
        <div className="pagination-buttons">
          <button 
            onClick={() => onPageChange(0)} 
            disabled={currentPage === 0 || isLoading}
            title="First page"
          >
            ⟪
          </button>
          <button 
            onClick={() => onPageChange(currentPage - 1)} 
            disabled={currentPage === 0 || isLoading}
            title="Previous page"
          >
            ◀
          </button>
          
          <span className="pagination-page">
            Page <strong>{currentPage + 1}</strong> of <strong>{totalPages || 1}</strong>
          </span>
          
          <button 
            onClick={() => onPageChange(currentPage + 1)} 
            disabled={currentPage >= totalPages - 1 || isLoading}
            title="Next page"
          >
            ▶
          </button>
          <button 
            onClick={() => onPageChange(totalPages - 1)} 
            disabled={currentPage >= totalPages - 1 || isLoading}
            title="Last page"
          >
            ⟫
          </button>
        </div>
        
        <div className="pagination-jump">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage + 1}
            onChange={(e) => {
              const page = Math.max(0, Math.min(totalPages - 1, Number(e.target.value) - 1));
              onPageChange(page);
            }}
            className="pagination-input"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DATA GRID WIDGET
// ============================================================================

// Column color configuration (from WidgetConfigModal)
interface ColumnColorConfig {
  column: string;
  type: 'preset' | 'custom';
  preset?: 'positive-negative' | 'heat-map' | 'status' | 'buy-sell';
  customColors?: Record<string, string>;
}

// Color presets (must match WidgetConfigModal)
const COLOR_PRESETS: Record<string, { name: string; rules?: Array<{ condition: string; min?: number; max?: number; style: React.CSSProperties }>; values?: Record<string, string> }> = {
  'positive-negative': { name: 'Positive/Negative', rules: [
    { condition: 'positive', style: { color: '#22c55e' } },
    { condition: 'negative', style: { color: '#ef4444' } },
  ]},
  'heat-map': { name: 'Heat Map', rules: [
    { condition: 'range', min: 0, max: 25, style: { background: '#22c55e33', color: '#22c55e' } },
    { condition: 'range', min: 25, max: 50, style: { background: '#f59e0b33', color: '#f59e0b' } },
    { condition: 'range', min: 50, max: 75, style: { background: '#f9731633', color: '#f97316' } },
    { condition: 'range', min: 75, max: 100, style: { background: '#ef444433', color: '#ef4444' } },
  ]},
  'status': { name: 'Status Badges', values: {
    'ACTIVE': '#22c55e', 'PENDING': '#f59e0b', 'FILLED': '#3b82f6',
    'CANCELLED': '#ef4444', 'NEW': '#06b6d4', 'REJECTED': '#dc2626',
  }},
  'buy-sell': { name: 'Buy/Sell', values: {
    'BUY': '#22c55e', 'SELL': '#ef4444', 'B': '#22c55e', 'S': '#ef4444',
  }},
};

interface DataGridWidgetProps {
  data: RayforceResult | unknown;
  colorRules?: CellColorRule[];
  config?: {
    showFlags?: boolean;
    showBadges?: boolean;
    showSparklines?: boolean;
    flashPrices?: boolean;
    columnColors?: Record<string, Record<string, string>>;
    columnColorConfigs?: ColumnColorConfig[];
    // Pagination config
    enablePagination?: boolean;
    defaultPageSize?: number;
    serverSidePagination?: boolean; // If true, expects data.rowCount for total
  };
  // Callback to fetch page data (for server-side pagination)
  onPageRequest?: (startIndex: number, endIndex: number) => Promise<void>;
}

export function DataGridWidget({ 
  data, 
  colorRules = DEFAULT_COLOR_RULES, 
  config = {},
  onPageRequest,
}: DataGridWidgetProps) {
  const { 
    showFlags = true, 
    showBadges = true, 
    showSparklines = true,
    flashPrices = true,
    columnColors = {},
    columnColorConfigs = [],
    enablePagination = true,
    defaultPageSize = 100,
    serverSidePagination = false,
  } = config;
  
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [isLoading, setIsLoading] = useState(false);
  
  // Extract total row count
  const totalRows = useMemo(() => {
    if (!data) return 0;
    const result = data as RayforceResult;
    if (result.rowCount !== undefined) return result.rowCount;
    if (result.type === 'table' && result.toJS) {
      const rows = result.toJS();
      return Array.isArray(rows) ? rows.length : 0;
    }
    if (Array.isArray(result.data)) return result.data.length;
    return 0;
  }, [data]);
  
  // Handle page change
  const handlePageChange = useCallback(async (page: number) => {
    setCurrentPage(page);
    
    if (serverSidePagination && onPageRequest) {
      setIsLoading(true);
      const start = page * pageSize;
      const end = start + pageSize;
      try {
        await onPageRequest(start, end);
      } finally {
        setIsLoading(false);
      }
    }
  }, [serverSidePagination, onPageRequest, pageSize]);
  
  // Handle page size change
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(0); // Reset to first page
    
    if (serverSidePagination && onPageRequest) {
      setIsLoading(true);
      onPageRequest(0, size).finally(() => setIsLoading(false));
    }
  }, [serverSidePagination, onPageRequest]);
  
  // Convert Rayforce result to AG Grid format with pagination
  const { rowData, columnDefs } = useMemo(() => {
    if (!data) {
      return { rowData: [], columnDefs: [] };
    }
    
    const result = data as RayforceResult;
    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];
    
    // Debug logging
    console.log('[DataGrid] Received data:', {
      rawData: data,
      resultType: result?.type,
      resultData: result?.data,
      isArray: Array.isArray(data),
      hasToJS: typeof result?.toJS === 'function',
    });
    
    // Helper to add unique row IDs
    const addRowIds = (rows: Record<string, unknown>[]) => 
      rows.map((row, idx) => ({ ...row, __rowId: `row-${idx}` }));
    
    // Extract data based on type - check for RayforceResult types
    if (result && result.type === 'table' && result.columns) {
      columns = result.columns;
      const jsData = result.toJS?.() || [];
      rows = addRowIds(Array.isArray(jsData) ? jsData : []);
    } else if (result && result.type === 'vector') {
      const arr = result.toJS?.() || result.data || [];
      if (Array.isArray(arr) && arr.length > 0) {
        columns = ['value'];
        rows = addRowIds(arr.map(value => ({ value })));
      }
    } else if (result && result.type === 'scalar') {
      const val = result.toJS?.() ?? result.data;
      // Scalar: check if it's a primitive or dict
      if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean' || val === null) {
        // Simple scalar - single row
        columns = ['value'];
        rows = [{ value: val, __rowId: 'scalar-0' }];
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        // Dict/object - expand to rows
        const dict = val as Record<string, unknown>;
        columns = Object.keys(dict);
        if (columns.length === 0) {
          columns = ['value'];
          rows = [{ value: val, __rowId: 'scalar-0' }];
        } else {
          const firstCol = dict[columns[0]];
          const rowCount = Array.isArray(firstCol) ? firstCol.length : 1;
          for (let i = 0; i < rowCount; i++) {
            const row: Record<string, unknown> = { __rowId: `dict-${i}` };
            for (const key of columns) {
              const col = dict[key];
              row[key] = Array.isArray(col) ? col[i] : col;
            }
            rows.push(row);
          }
        }
      } else {
        columns = ['value'];
        rows = [{ value: val, __rowId: 'scalar-0' }];
      }
    } else if (Array.isArray(data)) {
      // Raw array data (not RayforceResult)
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        columns = Object.keys(data[0]);
        rows = addRowIds(data as Record<string, unknown>[]);
      } else {
        columns = ['value'];
        rows = addRowIds(data.map(value => ({ value })));
      }
    } else if (typeof data === 'number' || typeof data === 'string' || typeof data === 'boolean') {
      // Raw scalar (not wrapped in RayforceResult)
      columns = ['value'];
      rows = [{ value: data, __rowId: 'raw-scalar-0' }];
    } else if (typeof data === 'object' && data !== null && !('type' in data)) {
      // Raw object/dict (not RayforceResult)
      const dict = data as Record<string, unknown>;
      columns = Object.keys(dict);
      if (columns.length > 0) {
        const firstCol = dict[columns[0]];
        const rowCount = Array.isArray(firstCol) ? firstCol.length : 1;
        for (let i = 0; i < rowCount; i++) {
          const row: Record<string, unknown> = { __rowId: `raw-dict-${i}` };
          for (const key of columns) {
            const col = dict[key];
            row[key] = Array.isArray(col) ? col[i] : col;
          }
          rows.push(row);
        }
      }
    }
    
    if (columns.length === 0) {
      return { rowData: [], columnDefs: [] };
    }
    
    // Apply client-side pagination (if not server-side)
    let paginatedRows = rows;
    if (enablePagination && !serverSidePagination && rows.length > pageSize) {
      const start = currentPage * pageSize;
      const end = start + pageSize;
      paginatedRows = rows.slice(start, end);
    }
    
    // Get actual Rayforce column types from result if available
    const rayforceColumnTypes: Record<string, string> = result?.columnTypes || {};
    
    // Detect column categories for rendering (from actual Rayforce types or fallback to value detection)
    const columnCategories: Record<string, 'number' | 'string' | 'currency' | 'status' | 'array' | 'time'> = {};
    const sampleRow = rows[0] || {};
    
    // Column names that typically contain buy/sell or status values
    const statusColumnNames = ['side', 'action', 'direction', 'type', 'status', 'state', 'order_type', 'ordertype'];
    
    for (const col of columns) {
      const rfType = rayforceColumnTypes[col];
      const val = sampleRow[col];
      const colLower = col.toLowerCase();
      
      // Check if column name suggests status/badge values
      const isStatusColumn = statusColumnNames.some(name => colLower === name || colLower.endsWith('_' + name));
      
      // Check if value looks like a badge value (buy/sell etc)
      const strVal = String(val || '').toUpperCase();
      const isBadgeValue = strVal in BADGE_COLORS;
      
      // Map Rayforce type to category for rendering
      if (rfType === 'list') {
        columnCategories[col] = 'array';
      } else if (isStatusColumn || isBadgeValue) {
        columnCategories[col] = 'status'; // Status columns get badge rendering
      } else if (rfType === 'sym') {
        columnCategories[col] = 'currency'; // sym columns get flag rendering
      } else if (rfType === 'ts' || rfType === 'date' || rfType === 'time') {
        columnCategories[col] = 'time';
      } else if (rfType === 'i16' || rfType === 'i32' || rfType === 'i64' || rfType === 'f64') {
        columnCategories[col] = 'number';
      } else if (rfType) {
        columnCategories[col] = 'string';
      } else {
        // Fallback to value-based detection
        if (Array.isArray(val)) {
          columnCategories[col] = 'array';
        } else if (typeof val === 'number') {
          columnCategories[col] = 'number';
        } else {
          columnCategories[col] = 'string';
        }
      }
    }
    
    // Build column definitions
    const columnDefs: ColDef[] = columns.map(name => {
      const category = columnCategories[name];
      // Use actual Rayforce type for display, fallback to category-based guess
      const typeLabel = rayforceColumnTypes[name] || category || 'str';
      const def: ColDef = {
        field: name,
        headerName: name,
        headerTooltip: `${name} (${typeLabel})`,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 90,
        // Show type in header using custom component
        headerComponent: CustomHeader,
        headerComponentParams: { columnType: typeLabel },
      };
      
      if (category === 'currency' && showFlags) {
        def.cellRenderer = FlagRenderer;
        def.minWidth = 120;
      } else if (category === 'status' && showBadges) {
        def.cellRenderer = BadgeRenderer;
        def.minWidth = 100;
      } else if (category === 'array' && showSparklines) {
        def.cellRenderer = SparklineRenderer;
        def.minWidth = 100;
        def.sortable = false;
        def.filter = false;
      } else if (category === 'number') {
        if (flashPrices && (name.toLowerCase().includes('price') || name.toLowerCase().includes('rate'))) {
          def.cellRenderer = PriceRenderer;
        }
        def.cellStyle = (params: CellClassParams) => {
          const val = params.value;
          if (typeof val !== 'number') return null;
          
          for (const rule of colorRules) {
            if (rule.column && rule.column !== '*' && rule.column !== name) continue;
            
            let matches = false;
            switch (rule.condition) {
              case 'positive': matches = val > 0; break;
              case 'negative': matches = val < 0; break;
              case 'zero': matches = val === 0; break;
              case 'range': matches = val >= (rule.min ?? -Infinity) && val <= (rule.max ?? Infinity); break;
              case 'equals': matches = val === rule.value; break;
            }
            
            if (matches) return rule.style;
          }
          return null;
        };
        
        def.valueFormatter = (params: ValueFormatterParams) => {
          const val = params.value;
          if (typeof val !== 'number') return val;
          if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(2) + 'M';
          if (Math.abs(val) >= 1000) return (val / 1000).toFixed(2) + 'K';
          if (Number.isInteger(val)) return val.toLocaleString();
          return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        };
      } else if (category === 'time') {
        def.valueFormatter = (params: ValueFormatterParams) => {
          const val = params.value;
          // Rayforce already formats timestamps as strings, just display them
          if (typeof val === 'string') return val;
          if (typeof val === 'number') return new Date(val).toLocaleTimeString();
          return val;
        };
      }
      
      // Apply user-configured column colors (from columnColorConfigs)
      const colorConfig = columnColorConfigs.find(cc => cc.column === name);
      if (colorConfig) {
        def.cellStyle = (params: CellClassParams): Record<string, string | number> | null | undefined => {
          const val = params.value;
          
          if (colorConfig.type === 'preset' && colorConfig.preset) {
            const preset = COLOR_PRESETS[colorConfig.preset];
            
            // Handle value-based presets (status, buy-sell)
            if (preset && 'values' in preset && preset.values) {
              const strVal = String(val || '').toUpperCase();
              const color = preset.values[strVal];
              if (color) return { background: color, color: '#fff', fontWeight: 600 };
            }
            
            // Handle rule-based presets (positive-negative, heat-map)
            if (preset && 'rules' in preset && preset.rules) {
              const numVal = typeof val === 'number' ? val : parseFloat(String(val));
              if (!isNaN(numVal)) {
                for (const rule of preset.rules) {
                  let matches = false;
                  switch (rule.condition) {
                    case 'positive': matches = numVal > 0; break;
                    case 'negative': matches = numVal < 0; break;
                    case 'zero': matches = numVal === 0; break;
                    case 'range': 
                      matches = numVal >= (rule.min ?? -Infinity) && numVal < (rule.max ?? Infinity);
                      break;
                  }
                  if (matches) return rule.style as Record<string, string | number>;
                }
              }
            }
          }
          
          // Handle custom colors
          if (colorConfig.type === 'custom' && colorConfig.customColors) {
            const strVal = String(val || '').toUpperCase();
            const color = colorConfig.customColors[strVal] || colorConfig.customColors[String(val || '')];
            if (color) return { background: color, color: '#fff', fontWeight: 600 };
          }
          
          return null;
        };
      }
      // Fallback to legacy columnColors format
      else {
        const customColors = columnColors[name];
        if (customColors && Object.keys(customColors).length > 0) {
          def.cellStyle = (params: CellClassParams) => {
            const val = String(params.value || '').toUpperCase();
            const color = customColors[val] || customColors[String(params.value || '')];
            if (color) return { background: color, color: '#fff', fontWeight: 600 };
            return null;
          };
        }
      }
      
      return def;
    });
    
    return { rowData: paginatedRows, columnDefs };
  }, [data, colorRules, showFlags, showBadges, showSparklines, flashPrices, columnColors, columnColorConfigs, currentPage, pageSize, enablePagination, serverSidePagination]);
  
  // Generate a key for AG Grid to force re-render when column color config changes
  const gridKey = useMemo(() => {
    return JSON.stringify(columnColorConfigs);
  }, [columnColorConfigs]);

  // Use actual row count for client-side pagination
  const displayTotalRows = serverSidePagination ? totalRows : (
    useMemo(() => {
      if (!data) return 0;
      const result = data as RayforceResult;
      if (result.type === 'table' && result.toJS) {
        const rows = result.toJS();
        return Array.isArray(rows) ? rows.length : 0;
      }
      if (Array.isArray(result.data)) return result.data.length;
      return rowData.length;
    }, [data, rowData.length])
  );
  
  if (!data) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        No data - bind a query to this widget
      </div>
    );
  }
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="ag-theme-alpine-dark" style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact
          key={gridKey}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            flex: 1,
            minWidth: 80,
            sortable: true,
            filter: true,
            resizable: true,
          }}
          animateRows={true}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          headerHeight={32}
          rowHeight={28}
          getRowId={(params: GetRowIdParams) => params.data?.__rowId || params.data?.id || String(Math.random())}
        />
      </div>
      
      {enablePagination && displayTotalRows > pageSize && (
        <Pagination
          currentPage={currentPage}
          totalRows={displayTotalRows}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

// ============================================================================
// HELPER: Generate Rayfall pagination query
// ============================================================================

/**
 * Generate a Rayfall query with pagination using [start end] indexing
 * 
 * Examples:
 *   paginateQuery('trades', 0, 100)    -> '(trades [0 100])'
 *   paginateQuery('trades', 100, 200)  -> '(trades [100 200])'
 *   paginateQuery('trades', -100, -1)  -> '(trades [-100 -1])'  // Last 100 rows
 */
export function paginateQuery(tableName: string, start: number, end: number): string {
  return `(${tableName} [${start} ${end}])`;
}

/**
 * Generate a count query for total rows
 */
export function countQuery(tableName: string): string {
  return `(count ${tableName})`;
}
