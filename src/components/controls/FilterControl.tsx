/**
 * FilterControl - Interactive data filter component
 */

import { useState, useEffect, useMemo } from 'react';
import { useRayLensStore } from '@core/store';

interface FilterCondition {
  column: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: string | number | string[];
}

interface FilterControlProps {
  onFilterChange?: (conditions: FilterCondition[]) => void;
}

export function FilterControl({ onFilterChange }: FilterControlProps) {
  const { dataset } = useRayLensStore();
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<FilterCondition['operator']>('eq');
  const [filterValue, setFilterValue] = useState<string>('');

  // Get available columns from dataset
  const columns = useMemo(() => {
    return dataset?.schema.map((s) => ({
      name: s.name,
      type: s.type,
    })) ?? [];
  }, [dataset]);

  // Get unique values for selected column (for 'in' operator)
  const [uniqueValues, setUniqueValues] = useState<string[]>([]);

  useEffect(() => {
    if (selectedColumn && dataset) {
      // In production, query Rayforce for distinct values
      // For now, generate sample values
      const sampleValues = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD'];
      setUniqueValues(sampleValues);
    }
  }, [selectedColumn, dataset]);

  const operators = [
    { value: 'eq', label: '=' },
    { value: 'ne', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'contains', label: 'contains' },
    { value: 'in', label: 'in' },
  ];

  const addCondition = () => {
    if (!selectedColumn || !filterValue) return;
    
    const newCondition: FilterCondition = {
      column: selectedColumn,
      operator: selectedOperator,
      value: selectedOperator === 'in' ? filterValue.split(',').map((v) => v.trim()) : filterValue,
    };
    
    const updated = [...conditions, newCondition];
    setConditions(updated);
    onFilterChange?.(updated);
    
    // Reset inputs
    setFilterValue('');
  };

  const removeCondition = (index: number) => {
    const updated = conditions.filter((_, i) => i !== index);
    setConditions(updated);
    onFilterChange?.(updated);
  };

  const clearAll = () => {
    setConditions([]);
    onFilterChange?.([]);
  };

  // Generate Rayfall expression for the filter
  const generateRayfallExpression = () => {
    if (conditions.length === 0) return '';
    
    const exprs = conditions.map((c) => {
      const col = c.column;
      const val = typeof c.value === 'string' ? `'${c.value}` : c.value;
      
      switch (c.operator) {
        case 'eq': return `(= ${col} ${val})`;
        case 'ne': return `(!= ${col} ${val})`;
        case 'gt': return `(> ${col} ${val})`;
        case 'lt': return `(< ${col} ${val})`;
        case 'gte': return `(>= ${col} ${val})`;
        case 'lte': return `(<= ${col} ${val})`;
        case 'contains': return `(like ${col} "*${c.value}*")`;
        case 'in': return `(in ${col} ['${(c.value as string[]).join("' '")}])`;
        default: return '';
      }
    });
    
    if (exprs.length === 1) return exprs[0] ?? '';
    return `(and ${exprs.filter(Boolean).join(' ')})`;
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Data Filter</span>
        {conditions.length > 0 && (
          <button
            onClick={clearAll}
            className="text-2xs text-gray-500 hover:text-red-500 dark:hover:text-red-400"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active conditions */}
      {conditions.length > 0 && (
        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 space-y-1">
          {conditions.map((cond, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 px-2 py-1 bg-ray-500/10 rounded text-2xs"
            >
              <span className="text-ray-600 dark:text-ray-400 font-medium">{cond.column}</span>
              <span className="text-gray-500">
                {operators.find((o) => o.value === cond.operator)?.label}
              </span>
              <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                {Array.isArray(cond.value) ? cond.value.join(', ') : String(cond.value)}
              </span>
              <button
                onClick={() => removeCondition(idx)}
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

      {/* Add condition form */}
      <div className="p-2 space-y-2 flex-1">
        {/* Column select */}
        <div>
          <label className="text-2xs text-gray-500 mb-1 block">Column</label>
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 focus:border-ray-500 focus:outline-none"
          >
            <option value="">Select column...</option>
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name}
              </option>
            ))}
          </select>
        </div>

        {/* Operator select */}
        <div>
          <label className="text-2xs text-gray-500 mb-1 block">Operator</label>
          <select
            value={selectedOperator}
            onChange={(e) => setSelectedOperator(e.target.value as FilterCondition['operator'])}
            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 focus:border-ray-500 focus:outline-none"
          >
            {operators.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value input */}
        <div>
          <label className="text-2xs text-gray-500 mb-1 block">
            Value {selectedOperator === 'in' && '(comma-separated)'}
          </label>
          {selectedOperator === 'in' && uniqueValues.length > 0 ? (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
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
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
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
              type="text"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder="Enter value..."
              className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none"
            />
          )}
        </div>

        {/* Add button */}
        <button
          onClick={addCondition}
          disabled={!selectedColumn || !filterValue}
          className="w-full px-3 py-1.5 bg-ray-600 hover:bg-ray-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600 text-white text-xs font-medium rounded transition-colors"
        >
          Add Condition
        </button>
      </div>

      {/* Rayfall expression preview */}
      {conditions.length > 0 && (
        <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="text-2xs text-gray-500 mb-1">Rayfall where:</div>
          <code className="text-2xs text-emerald-600 dark:text-emerald-400 break-all">
            {`(select {... from: t where: ${generateRayfallExpression()}})`}
          </code>
        </div>
      )}
    </div>
  );
}
