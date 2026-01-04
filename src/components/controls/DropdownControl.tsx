/**
 * DropdownControl - Selection dropdown for filtering
 * 
 * KX Dashboards-style dropdown with:
 * - Single or multi-select mode
 * - Data-bound options from Rayforce
 * - Search/filter functionality
 * - Select all / clear actions
 * - Keyboard navigation
 * 
 * @see https://code.kx.com/dashboards/dropdownlist/
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRayLensStore } from '@core/store';

interface DropdownControlProps {
  column?: string;
  multiple?: boolean;
  onChange?: (values: string[]) => void;
  onApply?: (rayfallExpr: string) => void;
  placeholder?: string;
  defaultValue?: string | string[];
  required?: boolean;
  sorted?: boolean;
  maxDisplayItems?: number;
}

export function DropdownControl({ 
  column, 
  multiple = false, 
  onChange,
  onApply,
  placeholder = 'Select...',
  defaultValue,
  required = false,
  sorted = true,
  maxDisplayItems = 100,
}: DropdownControlProps) {
  const { dataset, bridge, status } = useRayLensStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(() => {
    if (defaultValue) {
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    }
    return [];
  });
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Get column options
  const columns = useMemo(() => {
    return dataset?.schema.map((s) => s.name) ?? [];
  }, [dataset]);

  const [selectedColumn, setSelectedColumn] = useState(column ?? columns[0] ?? '');

  // Fetch distinct values from Rayforce
  useEffect(() => {
    async function fetchDistinct() {
      if (!selectedColumn || !dataset) {
        setOptions([]);
        return;
      }

      setLoading(true);
      setError(null);

      if (bridge && status === 'ready') {
        try {
          // Query Rayforce for distinct values: (distinct (at table 'column))
          const result = await bridge.eval(`(distinct (at ${dataset.id} '${selectedColumn}))`);
          
          if (result) {
            // Parse result - handle [val1 val2 ...] or (val1 val2 ...) format
            const str = String(result);
            let vals = str
              .replace(/^\s*[\[(]/, '')
              .replace(/[\])]\s*$/, '')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, maxDisplayItems);
            
            // Sort alphabetically if enabled
            if (sorted) {
              vals = vals.sort((a, b) => a.localeCompare(b));
            }
            
            setOptions(vals);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[Dropdown] Query failed:', err);
          setError('Could not fetch options');
        }
      }

      // Fallback sample options for demo
      const sampleOptions = selectedColumn.toLowerCase().includes('sym') || selectedColumn.toLowerCase().includes('symbol')
        ? ['AAPL', 'AMZN', 'AMD', 'GOOGL', 'META', 'MSFT', 'NFLX', 'NVDA', 'TSLA', 'UBER']
        : selectedColumn.toLowerCase().includes('side')
        ? ['buy', 'sell']
        : selectedColumn.toLowerCase().includes('exchange')
        ? ['HKEX', 'LSE', 'NASDAQ', 'NYSE', 'TSE']
        : ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'];

      setOptions(sampleOptions);
      setLoading(false);
    }

    fetchDistinct();
  }, [selectedColumn, dataset, bridge, status, sorted, maxDisplayItems]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((opt) =>
      opt.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const toggleOption = useCallback((value: string) => {
    let newSelected: string[];
    
    if (multiple) {
      if (selected.includes(value)) {
        newSelected = selected.filter((v) => v !== value);
      } else {
        newSelected = [...selected, value];
      }
    } else {
      newSelected = [value];
      setIsOpen(false);
    }
    
    setSelected(newSelected);
    onChange?.(newSelected);
  }, [multiple, selected, onChange]);

  const selectAll = useCallback(() => {
    const allFiltered = filteredOptions;
    setSelected(allFiltered);
    onChange?.(allFiltered);
  }, [filteredOptions, onChange]);

  const clearSelection = useCallback(() => {
    setSelected([]);
    onChange?.([]);
  }, [onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          toggleOption(filteredOptions[focusedIndex]!);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [isOpen, filteredOptions, focusedIndex, toggleOption]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (isOpen) {
      setFocusedIndex(0);
    }
  }, [isOpen]);

  // Generate Rayfall expression
  const rayfallExpr = useMemo(() => {
    if (selected.length === 0) return '';
    if (selected.length === 1) return `(= ${selectedColumn} '${selected[0]})`;
    return `(in ${selectedColumn} ['${selected.join("' '")}])`;
  }, [selectedColumn, selected]);

  const handleApply = useCallback(() => {
    if (rayfallExpr) {
      onApply?.(rayfallExpr);
    }
  }, [rayfallExpr, onApply]);

  // Validation
  const isValid = !required || selected.length > 0;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded overflow-hidden" ref={dropdownRef}>
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Dropdown</span>
        {multiple && selected.length > 0 && (
          <span className="text-2xs text-ray-600 dark:text-ray-400">{selected.length} selected</span>
        )}
      </div>

      {/* Column selector (if not fixed) */}
      {!column && (
        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700">
          <label className="text-2xs text-gray-500 mb-1 block">Column</label>
          <select
            value={selectedColumn}
            onChange={(e) => {
              setSelectedColumn(e.target.value);
              setSelected([]);
            }}
            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 focus:border-ray-500 focus:outline-none"
          >
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="p-2" onKeyDown={handleKeyDown}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border rounded text-xs text-left flex items-center justify-between transition-colors ${
            !isValid 
              ? 'border-red-400 dark:border-red-500' 
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }`}
        >
          <span className={selected.length > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>
            {selected.length === 0
              ? placeholder
              : multiple
              ? `${selected.length} item${selected.length > 1 ? 's' : ''} selected`
              : selected[0]}
          </span>
          <div className="flex items-center gap-1">
            {selected.length > 0 && !multiple && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg overflow-hidden z-50">
            {/* Search */}
            <div className="p-1.5 border-b border-gray-200 dark:border-gray-700">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type to search..."
                className="w-full px-2 py-1 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none"
              />
            </div>

            {/* Bulk actions (multiple) */}
            {multiple && (
              <div className="px-1.5 py-1 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    onClick={selectAll}
                    className="text-2xs text-ray-600 dark:text-ray-400 hover:text-ray-500 dark:hover:text-ray-300"
                  >
                    Select all ({filteredOptions.length})
                  </button>
                  <span className="text-gray-400 dark:text-gray-600">|</span>
                  <button
                    onClick={clearSelection}
                    className="text-2xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
                <span className="text-2xs text-gray-400">{selected.length} selected</span>
              </div>
            )}

            {/* Options list */}
            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="px-3 py-4 text-center">
                  <div className="w-4 h-4 border-2 border-ray-500 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                  <div className="text-2xs text-gray-500">Loading options...</div>
                </div>
              ) : error ? (
                <div className="px-3 py-2 text-2xs text-red-500">{error}</div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-2xs text-gray-500">
                  {search ? 'No matches found' : 'No options available'}
                </div>
              ) : (
                filteredOptions.map((opt, idx) => (
                  <button
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`w-full px-2 py-1.5 text-xs text-left flex items-center gap-2 transition-colors ${
                      idx === focusedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
                    } ${
                      selected.includes(opt) 
                        ? 'text-ray-600 dark:text-ray-400 bg-ray-50 dark:bg-ray-900/20' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {multiple && (
                      <span
                        className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                          selected.includes(opt)
                            ? 'bg-ray-500 border-ray-500'
                            : 'border-gray-400 dark:border-gray-600'
                        }`}
                      >
                        {selected.includes(opt) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    )}
                    {!multiple && selected.includes(opt) && (
                      <svg className="w-3.5 h-3.5 text-ray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="truncate">{opt}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected values display */}
      {multiple && selected.length > 0 && (
        <div className="px-2 pb-2 flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {selected.map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-ray-500/20 text-ray-600 dark:text-ray-400 rounded text-2xs"
              >
                {val}
                <button
                  onClick={() => toggleOption(val)}
                  className="hover:text-ray-800 dark:hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rayfall expression */}
      {rayfallExpr && (
        <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs text-gray-500">Rayfall:</span>
            {onApply && (
              <button
                onClick={handleApply}
                className="px-2 py-0.5 bg-ray-600 hover:bg-ray-500 text-white text-2xs rounded transition-colors"
              >
                Apply
              </button>
            )}
          </div>
          <code className="text-2xs text-emerald-600 dark:text-emerald-400 break-all block">{rayfallExpr}</code>
        </div>
      )}
      
      {/* Validation message */}
      {required && !isValid && (
        <div className="px-2 py-1 text-2xs text-red-500">
          Selection required
        </div>
      )}
    </div>
  );
}
