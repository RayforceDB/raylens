/**
 * FilterControl - Interactive data filter component
 * 
 * KX Dashboards-style data filtering with:
 * - Quick text search mode
 * - Visual condition builder
 * - Column type awareness
 * - Date range support
 * - Live filter preview
 * 
 * @see https://code.kx.com/dashboards/datafilter/
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRayLensStore } from '@core/store';

type Operator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'between' | 'isNull' | 'notNull';

interface FilterCondition {
  id: string;
  column: string;
  operator: Operator;
  value: string | number | string[];
  value2?: string | number | undefined; // For 'between' operator
  enabled: boolean;
}

interface FilterControlProps {
  onFilterChange?: (conditions: FilterCondition[]) => void;
  onApply?: (rayfallExpr: string) => void;
  mode?: 'simple' | 'advanced';
  compact?: boolean;
}

export function FilterControl({ 
  onFilterChange, 
  onApply,
  mode: initialMode = 'simple',
  compact = false,
}: FilterControlProps) {
  const { dataset, bridge, status } = useRayLensStore();
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<Operator>('eq');
  const [filterValue, setFilterValue] = useState<string>('');
  const [filterValue2, setFilterValue2] = useState<string>(''); // For between
  const [mode, setMode] = useState<'simple' | 'advanced'>(initialMode);
  const [quickSearch, setQuickSearch] = useState('');

  // Get available columns from dataset
  const columns = useMemo(() => {
    return dataset?.schema.map((s) => ({
      name: s.name,
      type: s.type,
      isNumeric: ['i64', 'i32', 'i16', 'f64'].includes(s.type),
      isDate: ['timestamp', 'date', 'time'].includes(s.type),
    })) ?? [];
  }, [dataset]);

  // Selected column info
  const selectedColumnInfo = useMemo(() => {
    return columns.find(c => c.name === selectedColumn);
  }, [columns, selectedColumn]);

  // Get unique values for selected column (for 'in' operator)
  const [uniqueValues, setUniqueValues] = useState<string[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);

  // Fetch distinct values from Rayforce
  useEffect(() => {
    async function fetchDistinct() {
      if (!selectedColumn || !dataset || !bridge || status !== 'ready') {
        setUniqueValues([]);
        return;
      }

      setLoadingValues(true);
      try {
        // Query distinct values: (distinct (at table 'column))
        const result = await bridge.eval(`(distinct (at ${dataset.id} '${selectedColumn}))`);
        if (result) {
          // Parse result - handle [val1 val2 ...] format
          const str = String(result);
          const vals = str
            .replace(/^\s*[\[(]/, '')
            .replace(/[\])]\s*$/, '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 50); // Limit to 50 values
          setUniqueValues(vals);
        }
      } catch (err) {
        console.warn('[FilterControl] Could not fetch distinct values:', err);
        // Fallback sample values
        const sampleValues = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD'];
        setUniqueValues(sampleValues);
      } finally {
        setLoadingValues(false);
      }
    }

    fetchDistinct();
  }, [selectedColumn, dataset, bridge, status]);

  // Operators grouped by type
  const numericOperators: { value: Operator; label: string }[] = [
    { value: 'eq', label: '=' },
    { value: 'ne', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'between', label: 'between' },
  ];
  
  const textOperators: { value: Operator; label: string }[] = [
    { value: 'eq', label: '=' },
    { value: 'ne', label: '≠' },
    { value: 'contains', label: 'contains' },
    { value: 'in', label: 'in list' },
  ];
  
  const commonOperators: { value: Operator; label: string }[] = [
    { value: 'isNull', label: 'is null' },
    { value: 'notNull', label: 'is not null' },
  ];
  
  // Get operators based on column type
  const operators = useMemo(() => {
    if (selectedColumnInfo?.isNumeric || selectedColumnInfo?.isDate) {
      return [...numericOperators, ...commonOperators];
    }
    return [...textOperators, ...commonOperators];
  }, [selectedColumnInfo]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addCondition = useCallback(() => {
    // Null checks don't need a value
    if (!selectedColumn) return;
    if (!['isNull', 'notNull'].includes(selectedOperator) && !filterValue) return;
    
    const newCondition: FilterCondition = {
      id: generateId(),
      column: selectedColumn,
      operator: selectedOperator,
      value: selectedOperator === 'in' 
        ? filterValue.split(',').map((v) => v.trim()) 
        : filterValue,
      value2: selectedOperator === 'between' ? filterValue2 : undefined,
      enabled: true,
    };
    
    const updated = [...conditions, newCondition];
    setConditions(updated);
    onFilterChange?.(updated);
    
    // Reset inputs
    setFilterValue('');
    setFilterValue2('');
  }, [selectedColumn, selectedOperator, filterValue, filterValue2, conditions, onFilterChange]);

  const removeCondition = (id: string) => {
    const updated = conditions.filter((c) => c.id !== id);
    setConditions(updated);
    onFilterChange?.(updated);
  };

  const toggleCondition = (id: string) => {
    const updated = conditions.map((c) => 
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
    setConditions(updated);
    onFilterChange?.(updated);
  };

  const clearAll = () => {
    setConditions([]);
    onFilterChange?.([]);
    setQuickSearch('');
  };

  // Generate Rayfall expression for the filter
  const generateRayfallExpression = useCallback(() => {
    const activeConditions = conditions.filter(c => c.enabled);
    if (activeConditions.length === 0 && !quickSearch) return '';
    
    const exprs: string[] = [];
    
    // Quick search creates a 'contains' on all string columns
    if (quickSearch && mode === 'simple') {
      const stringCols = columns.filter(c => !c.isNumeric && !c.isDate);
      if (stringCols.length > 0) {
        const searchExprs = stringCols.map(c => `(like ${c.name} "*${quickSearch}*")`);
        exprs.push(searchExprs.length === 1 ? searchExprs[0] ?? '' : `(or ${searchExprs.join(' ')})`);
      }
    }
    
    // Build expressions for each condition
    activeConditions.forEach((c) => {
      const col = c.column;
      const val = typeof c.value === 'string' 
        ? (selectedColumnInfo?.isNumeric ? c.value : `'${c.value}`)
        : c.value;
      
      switch (c.operator) {
        case 'eq': exprs.push(`(= ${col} ${val})`); break;
        case 'ne': exprs.push(`(!= ${col} ${val})`); break;
        case 'gt': exprs.push(`(> ${col} ${val})`); break;
        case 'lt': exprs.push(`(< ${col} ${val})`); break;
        case 'gte': exprs.push(`(>= ${col} ${val})`); break;
        case 'lte': exprs.push(`(<= ${col} ${val})`); break;
        case 'contains': exprs.push(`(like ${col} "*${c.value}*")`); break;
        case 'in': exprs.push(`(in ${col} ['${(c.value as string[]).join("' '")}])`); break;
        case 'between': exprs.push(`(and (>= ${col} ${val}) (<= ${col} ${c.value2}))`); break;
        case 'isNull': exprs.push(`(null? ${col})`); break;
        case 'notNull': exprs.push(`(not (null? ${col}))`); break;
      }
    });
    
    if (exprs.length === 0) return '';
    if (exprs.length === 1) return exprs[0] ?? '';
    return `(and ${exprs.join(' ')})`;
  }, [conditions, quickSearch, mode, columns, selectedColumnInfo]);

  const rayfallExpr = generateRayfallExpression();

  const handleApply = () => {
    if (rayfallExpr) {
      onApply?.(rayfallExpr);
    }
  };

  // Operator label helper
  const getOperatorLabel = (op: Operator) => {
    const all = [...numericOperators, ...textOperators, ...commonOperators];
    return all.find(o => o.value === op)?.label ?? op;
  };

  return (
    <div className={`h-full flex flex-col bg-white dark:bg-gray-900 rounded overflow-hidden ${compact ? 'text-2xs' : ''}`}>
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-ray-600 dark:text-ray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Data Filter</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <button
            onClick={() => setMode(m => m === 'simple' ? 'advanced' : 'simple')}
            className={`px-2 py-0.5 text-2xs rounded transition-colors ${
              mode === 'advanced' 
                ? 'bg-ray-600 text-white' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {mode === 'simple' ? 'Advanced' : 'Simple'}
          </button>
          {(conditions.length > 0 || quickSearch) && (
            <button
              onClick={clearAll}
              className="text-2xs text-gray-500 hover:text-red-500 dark:hover:text-red-400"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Quick Search (Simple Mode) */}
      {mode === 'simple' && (
        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Quick search all fields..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Active conditions */}
      {conditions.length > 0 && (
        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 space-y-1 max-h-32 overflow-y-auto">
          {conditions.map((cond) => (
            <div
              key={cond.id}
              className={`flex items-center gap-1 px-2 py-1 rounded text-2xs transition-opacity ${
                cond.enabled ? 'bg-ray-500/10' : 'bg-gray-100 dark:bg-gray-800 opacity-50'
              }`}
            >
              <button
                onClick={() => toggleCondition(cond.id)}
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                  cond.enabled ? 'bg-ray-500 border-ray-500' : 'border-gray-400 dark:border-gray-600'
                }`}
              >
                {cond.enabled && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className="text-ray-600 dark:text-ray-400 font-medium">{cond.column}</span>
              <span className="text-gray-500">{getOperatorLabel(cond.operator)}</span>
              <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                {['isNull', 'notNull'].includes(cond.operator) 
                  ? '' 
                  : cond.operator === 'between'
                    ? `${cond.value} - ${cond.value2}`
                    : Array.isArray(cond.value) 
                      ? cond.value.join(', ') 
                      : String(cond.value)}
              </span>
              <button
                onClick={() => removeCondition(cond.id)}
                className="text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-0.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add condition form (Advanced Mode) */}
      {mode === 'advanced' && (
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
          {/* Column select */}
          <div>
            <label className="text-2xs text-gray-500 mb-1 block">Column</label>
            <select
              value={selectedColumn}
              onChange={(e) => {
                setSelectedColumn(e.target.value);
                setSelectedOperator('eq');
                setFilterValue('');
              }}
              className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 focus:border-ray-500 focus:outline-none"
            >
              <option value="">Select column...</option>
              {columns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name} {col.isNumeric ? '(#)' : col.isDate ? '(📅)' : '(Abc)'}
                </option>
              ))}
            </select>
          </div>

          {/* Operator select */}
          <div>
            <label className="text-2xs text-gray-500 mb-1 block">Operator</label>
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value as Operator)}
              className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 focus:border-ray-500 focus:outline-none"
            >
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          {/* Value input - show based on operator */}
          {!['isNull', 'notNull'].includes(selectedOperator) && (
            <div>
              <label className="text-2xs text-gray-500 mb-1 block">
                Value {selectedOperator === 'in' && '(comma-separated)'}
                {selectedOperator === 'between' && '(from)'}
              </label>
              
              {/* Multi-select for 'in' operator */}
              {selectedOperator === 'in' && uniqueValues.length > 0 ? (
                <div className="space-y-1">
                  {loadingValues ? (
                    <div className="text-2xs text-gray-500">Loading values...</div>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-800/50 rounded">
                      {uniqueValues.map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            const current = filterValue ? filterValue.split(',').map((v) => v.trim()) : [];
                            if (current.includes(val)) {
                              setFilterValue(current.filter((v) => v !== val).join(', '));
                            } else {
                              setFilterValue([...current, val].join(', '));
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded text-2xs transition-colors ${
                            filterValue.split(',').map((v) => v.trim()).includes(val)
                              ? 'bg-ray-500 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="Or type values..."
                    className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none"
                  />
                </div>
              ) : (
                <input
                  type={selectedColumnInfo?.isNumeric ? 'number' : selectedColumnInfo?.isDate ? 'datetime-local' : 'text'}
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  placeholder="Enter value..."
                  className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none"
                />
              )}
              
              {/* Second value for 'between' */}
              {selectedOperator === 'between' && (
                <>
                  <label className="text-2xs text-gray-500 mb-1 mt-2 block">Value (to)</label>
                  <input
                    type={selectedColumnInfo?.isNumeric ? 'number' : selectedColumnInfo?.isDate ? 'datetime-local' : 'text'}
                    value={filterValue2}
                    onChange={(e) => setFilterValue2(e.target.value)}
                    placeholder="Enter end value..."
                    className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none"
                  />
                </>
              )}
            </div>
          )}

          {/* Add button */}
          <button
            onClick={addCondition}
            disabled={!selectedColumn || (!['isNull', 'notNull'].includes(selectedOperator) && !filterValue)}
            className="w-full px-3 py-1.5 bg-ray-600 hover:bg-ray-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600 text-white text-xs font-medium rounded transition-colors"
          >
            Add Condition
          </button>
        </div>
      )}

      {/* Rayfall expression preview */}
      {rayfallExpr && (
        <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs text-gray-500">Rayfall where:</span>
            {onApply && (
              <button
                onClick={handleApply}
                className="px-2 py-0.5 bg-ray-600 hover:bg-ray-500 text-white text-2xs rounded transition-colors"
              >
                Apply Filter
              </button>
            )}
          </div>
          <code className="text-2xs text-emerald-600 dark:text-emerald-400 break-all block">
            {rayfallExpr}
          </code>
        </div>
      )}
      
      {/* Stats */}
      <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 text-2xs text-gray-500">
        {conditions.length} condition{conditions.length !== 1 ? 's' : ''} 
        {conditions.filter(c => c.enabled).length !== conditions.length && (
          <span> ({conditions.filter(c => c.enabled).length} active)</span>
        )}
      </div>
    </div>
  );
}
