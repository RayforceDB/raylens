import { useState } from 'react';
import { useLensStore, Widget } from '../store';
import type { RayforceResult } from '../lib/rayforce';

// Predefined color presets
const COLOR_PRESETS = {
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

interface ColumnColorConfig {
  column: string;
  type: 'preset' | 'custom';
  preset?: keyof typeof COLOR_PRESETS;
  customColors?: Record<string, string>;
}

interface WidgetConfigModalProps {
  widget: Widget;
  dashboardId: string;
  onClose: () => void;
}

export function WidgetConfigModal({ widget, dashboardId, onClose }: WidgetConfigModalProps) {
  const queries = useLensStore(state => state.workspace.queries);
  const updateWidget = useLensStore(state => state.updateWidget);
  
  const [title, setTitle] = useState(widget.title);
  const [queryId, setQueryId] = useState(widget.binding?.queryId || '');
  const [refreshInterval, setRefreshInterval] = useState(widget.binding?.refreshInterval || 0);
  const [autoRun, setAutoRun] = useState(widget.binding?.autoRun || false);
  const [chartType, setChartType] = useState((widget.config.chartType as string) || 'line');
  
  // Grid-specific config
  const [showFlags, setShowFlags] = useState((widget.config.showFlags as boolean) ?? true);
  const [showBadges, setShowBadges] = useState((widget.config.showBadges as boolean) ?? true);
  const [flashPrices, setFlashPrices] = useState((widget.config.flashPrices as boolean) ?? true);
  const [columnColors, setColumnColors] = useState<ColumnColorConfig[]>(
    (widget.config.columnColorConfigs as ColumnColorConfig[]) || []
  );
  
  // Tab for grid config
  const [activeTab, setActiveTab] = useState<'general' | 'columns' | 'style'>('general');
  
  // Get column names from bound query result
  const boundQuery = queries.find(q => q.id === queryId);
  const availableColumns: string[] = (() => {
    if (!boundQuery?.lastResult) return [];
    const result = boundQuery.lastResult as RayforceResult;
    
    // Direct columns array
    if (result.columns && Array.isArray(result.columns)) {
      return result.columns;
    }
    
    // Try to get from toJS()
    if (result.toJS) {
      try {
        const data = result.toJS();
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
          return Object.keys(data[0] as object);
        }
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          return Object.keys(data);
        }
      } catch {
        // Ignore errors
      }
    }
    
    return [];
  })();
  
  const handleSave = () => {
    // Build columnColors config from columnColorConfigs
    const columnColorsConfig: Record<string, Record<string, string>> = {};
    for (const cc of columnColors) {
      if (cc.type === 'preset' && cc.preset) {
        const preset = COLOR_PRESETS[cc.preset];
        if ('values' in preset) {
          columnColorsConfig[cc.column] = preset.values;
        }
      } else if (cc.type === 'custom' && cc.customColors) {
        columnColorsConfig[cc.column] = cc.customColors;
      }
    }
    
    updateWidget(dashboardId, widget.id, {
      title,
      binding: queryId ? { queryId, refreshInterval, autoRun } : undefined,
      config: { 
        ...widget.config, 
        chartType,
        showFlags,
        showBadges,
        flashPrices,
        columnColors: columnColorsConfig,
        columnColorConfigs: columnColors,
      },
    });
    onClose();
  };
  
  const addColumnColor = () => {
    if (availableColumns.length === 0) return;
    setColumnColors([...columnColors, { 
      column: availableColumns[0], 
      type: 'preset', 
      preset: 'positive-negative' 
    }]);
  };
  
  const updateColumnColor = (index: number, updates: Partial<ColumnColorConfig>) => {
    const newConfigs = [...columnColors];
    newConfigs[index] = { ...newConfigs[index], ...updates };
    setColumnColors(newConfigs);
  };
  
  const removeColumnColor = (index: number) => {
    setColumnColors(columnColors.filter((_, i) => i !== index));
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure {widget.type === 'grid' ? 'Data Grid' : widget.type === 'chart' ? 'Chart' : 'Widget'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        {widget.type === 'grid' && (
          <div className="modal-tabs">
            <button 
              className={`modal-tab ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button 
              className={`modal-tab ${activeTab === 'columns' ? 'active' : ''}`}
              onClick={() => setActiveTab('columns')}
            >
              Column Colors
            </button>
            <button 
              className={`modal-tab ${activeTab === 'style' ? 'active' : ''}`}
              onClick={() => setActiveTab('style')}
            >
              Display Options
            </button>
          </div>
        )}
        
        <div className="modal-body">
          {/* General Tab */}
          {(activeTab === 'general' || widget.type !== 'grid') && (
            <>
              <div className="form-group">
                <label>Widget Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Widget title"
                />
              </div>
              
              <div className="form-group">
                <label>Bound Query</label>
                <select value={queryId} onChange={(e) => setQueryId(e.target.value)}>
                  <option value="">-- Select Query --</option>
                  {queries.map((q) => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </select>
              </div>
              
              {queryId && (
                <>
                  <div className="form-group">
                    <label>Refresh Interval</label>
                    <select 
                      value={refreshInterval} 
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    >
                      <option value={0}>Manual only</option>
                      <option value={1000}>1 second</option>
                      <option value={2000}>2 seconds</option>
                      <option value={5000}>5 seconds</option>
                      <option value={10000}>10 seconds</option>
                      <option value={30000}>30 seconds</option>
                      <option value={60000}>1 minute</option>
                    </select>
                  </div>
                  
                  <div className="form-group checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={autoRun}
                        onChange={(e) => setAutoRun(e.target.checked)}
                      />
                      Auto-run on load
                    </label>
                  </div>
                </>
              )}
              
              {widget.type === 'chart' && (
                <div className="form-group">
                  <label>Chart Type</label>
                  <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
                    <option value="line">Line Chart</option>
                    <option value="bar">Bar Chart</option>
                    <option value="pie">Pie Chart</option>
                    <option value="area">Area Chart</option>
                    <option value="candlestick">Candlestick</option>
                  </select>
                </div>
              )}
            </>
          )}
          
          {/* Column Colors Tab */}
          {activeTab === 'columns' && widget.type === 'grid' && (
            <div className="column-colors-config">
              <div className="config-section-header">
                <span>Column Color Rules</span>
                <button 
                  className="btn btn-sm"
                  onClick={addColumnColor}
                  disabled={availableColumns.length === 0}
                >
                  + Add Rule
                </button>
              </div>
              
              {availableColumns.length === 0 && (
                <div className="config-hint">
                  Run the bound query first to see available columns
                </div>
              )}
              
              {columnColors.map((cc, index) => (
                <div key={index} className="column-color-row">
                  <select 
                    value={cc.column}
                    onChange={(e) => updateColumnColor(index, { column: e.target.value })}
                  >
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  
                  <select
                    value={cc.type === 'preset' ? cc.preset : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        updateColumnColor(index, { type: 'custom', customColors: {} });
                      } else {
                        updateColumnColor(index, { 
                          type: 'preset', 
                          preset: val as keyof typeof COLOR_PRESETS 
                        });
                      }
                    }}
                  >
                    <optgroup label="Presets">
                      {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
                        <option key={key} value={key}>{preset.name}</option>
                      ))}
                    </optgroup>
                    <option value="custom">Custom Colors...</option>
                  </select>
                  
                  <button 
                    className="btn btn-icon btn-danger"
                    onClick={() => removeColumnColor(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              
              {columnColors.some(cc => cc.type === 'custom') && (
                <div className="custom-colors-editor">
                  <div className="config-section-header">
                    <span>Custom Value Colors</span>
                  </div>
                  {columnColors.filter(cc => cc.type === 'custom').map((cc, ccIndex) => {
                    const actualIndex = columnColors.findIndex(c => c === cc);
                    return (
                      <div key={ccIndex} className="custom-color-group">
                        <div className="custom-color-group-header">{cc.column}</div>
                        <CustomColorEditor
                          colors={cc.customColors || {}}
                          onChange={(colors) => updateColumnColor(actualIndex, { customColors: colors })}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="preset-preview">
                <div className="config-section-header">
                  <span>Preset Preview</span>
                </div>
                <div className="preset-samples">
                  <div className="preset-sample">
                    <span style={{ color: '#22c55e' }}>+1,234.56</span>
                    <span className="preset-label">Positive</span>
                  </div>
                  <div className="preset-sample">
                    <span style={{ color: '#ef4444' }}>-567.89</span>
                    <span className="preset-label">Negative</span>
                  </div>
                  <div className="preset-sample">
                    <span className="badge" style={{ background: '#22c55e' }}>BUY</span>
                    <span className="preset-label">Status Badge</span>
                  </div>
                  <div className="preset-sample">
                    <span className="badge" style={{ background: '#ef4444' }}>SELL</span>
                    <span className="preset-label">Status Badge</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Display Options Tab */}
          {activeTab === 'style' && widget.type === 'grid' && (
            <div className="style-config">
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={showFlags}
                    onChange={(e) => setShowFlags(e.target.checked)}
                  />
                  <span className="checkbox-label">
                    Show Currency Flags
                    <span className="checkbox-hint">Display country flags for currency pair columns (e.g., 🇪🇺 EURUSD)</span>
                  </span>
                </label>
              </div>
              
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={showBadges}
                    onChange={(e) => setShowBadges(e.target.checked)}
                  />
                  <span className="checkbox-label">
                    Show Status Badges
                    <span className="checkbox-hint">Display colored badges for status columns (e.g., ACTIVE, PENDING)</span>
                  </span>
                </label>
              </div>
              
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={flashPrices}
                    onChange={(e) => setFlashPrices(e.target.checked)}
                  />
                  <span className="checkbox-label">
                    Flash Price Changes
                    <span className="checkbox-hint">Highlight cells that have changed value (green/red flash)</span>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// Custom color editor component
function CustomColorEditor({ 
  colors, 
  onChange 
}: { 
  colors: Record<string, string>; 
  onChange: (colors: Record<string, string>) => void;
}) {
  const [newValue, setNewValue] = useState('');
  const [newColor, setNewColor] = useState('#22c55e');
  
  const addColor = () => {
    if (!newValue.trim()) return;
    onChange({ ...colors, [newValue.toUpperCase()]: newColor });
    setNewValue('');
  };
  
  const removeColor = (value: string) => {
    const { [value]: _, ...rest } = colors;
    onChange(rest);
  };
  
  return (
    <div className="custom-color-editor">
      <div className="custom-color-list">
        {Object.entries(colors).map(([value, color]) => (
          <div key={value} className="custom-color-item">
            <span 
              className="color-preview" 
              style={{ background: color }}
            />
            <span className="color-value">{value}</span>
            <input
              type="color"
              value={color}
              onChange={(e) => onChange({ ...colors, [value]: e.target.value })}
            />
            <button 
              className="btn btn-icon btn-sm"
              onClick={() => removeColor(value)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      
      <div className="custom-color-add">
        <input
          type="text"
          placeholder="Value (e.g., OPEN)"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addColor()}
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
        />
        <button className="btn btn-sm" onClick={addColor}>Add</button>
      </div>
    </div>
  );
}
