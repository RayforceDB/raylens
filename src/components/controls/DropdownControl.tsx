/**
 * DropdownControl - Selection dropdown for filtering
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRayLensStore } from '@core/store';

interface DropdownControlProps {
  column?: string;
  multiple?: boolean;
  onChange?: (values: string[]) => void;
}

export function DropdownControl({ column, multiple = false, onChange }: DropdownControlProps) {
  const { dataset, bridge, status } = useRayLensStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get column options
  const columns = useMemo(() => {
    return dataset?.schema.map((s) => s.name) ?? [];
  }, [dataset]);

  const [selectedColumn, setSelectedColumn] = useState(column ?? columns[0] ?? '');

  // Fetch distinct values for column
  useEffect(() => {
    async function fetchDistinct() {
      if (!selectedColumn) {
        setOptions([]);
        return;
      }

      setLoading(true);

      if (bridge && status === 'ready') {
        try {
          // Query Rayforce for distinct values
          const result = await bridge.eval(`distinct ${selectedColumn}`);
          console.log('[Dropdown] Distinct values:', result);
          // Parse result - for now use sample data
          // In production, parse the actual Rayforce response
        } catch (err) {
          console.error('[Dropdown] Query failed:', err);
        }
      }

      // Sample options for demo
      const sampleOptions = selectedColumn.toLowerCase().includes('sym') || selectedColumn.toLowerCase().includes('symbol')
        ? ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD', 'NFLX', 'UBER']
        : selectedColumn.toLowerCase().includes('side')
        ? ['buy', 'sell']
        : selectedColumn.toLowerCase().includes('exchange')
        ? ['NYSE', 'NASDAQ', 'LSE', 'TSE', 'HKEX']
        : ['Value 1', 'Value 2', 'Value 3', 'Value 4', 'Value 5'];

      setOptions(sampleOptions);
      setLoading(false);
    }

    fetchDistinct();
  }, [selectedColumn, bridge, status]);

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

  const toggleOption = (value: string) => {
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
  };

  const selectAll = () => {
    setSelected(options);
    onChange?.(options);
  };

  const clearSelection = () => {
    setSelected([]);
    onChange?.([]);
  };

  // Generate Rayfall expression
  const rayfallExpr = useMemo(() => {
    if (selected.length === 0) return '';
    if (selected.length === 1) return `(= ${selectedColumn} '${selected[0]})`;
    return `(in ${selectedColumn} ['${selected.join("' '")}])`;
  }, [selectedColumn, selected]);

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
      <div className="p-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-left flex items-center justify-between hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
        >
          <span className={selected.length > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>
            {selected.length === 0
              ? 'Select...'
              : multiple
              ? `${selected.length} item${selected.length > 1 ? 's' : ''}`
              : selected[0]}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg overflow-hidden">
            {/* Search */}
            <div className="p-1.5 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Bulk actions (multiple) */}
            {multiple && (
              <div className="px-1.5 py-1 border-b border-gray-200 dark:border-gray-700 flex gap-1">
                <button
                  onClick={selectAll}
                  className="text-2xs text-ray-600 dark:text-ray-400 hover:text-ray-500 dark:hover:text-ray-300"
                >
                  Select all
                </button>
                <span className="text-gray-400 dark:text-gray-600">|</span>
                <button
                  onClick={clearSelection}
                  className="text-2xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Options list */}
            <div className="max-h-40 overflow-y-auto">
              {loading ? (
                <div className="px-3 py-2 text-2xs text-gray-500">Loading...</div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-2xs text-gray-500">No options</div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`w-full px-2 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      selected.includes(opt) ? 'text-ray-600 dark:text-ray-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {multiple && (
                      <span
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
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
                    {opt}
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
      {selected.length > 0 && (
        <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="text-2xs text-gray-500">Rayfall:</div>
          <code className="text-2xs text-emerald-600 dark:text-emerald-400 break-all">{rayfallExpr}</code>
        </div>
      )}
    </div>
  );
}
