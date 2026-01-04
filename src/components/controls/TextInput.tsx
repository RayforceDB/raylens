/**
 * TextInput - Text input control for Rayfall expressions, search, or values
 * 
 * Inspired by KX Dashboards text input component with:
 * - Multiple input types (text, number, expression, search, multiline)
 * - Expression mode with syntax highlighting and autocomplete
 * - Search mode with typeahead suggestions
 * - Validation (required, min/max, pattern)
 * - History for expression mode
 * - Multiline mode for large text/code
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRayLensStore } from '@core/store';

type InputType = 'text' | 'number' | 'expression' | 'search' | 'multiline';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: (value: string) => string | null; // Return error message or null
}

interface TextInputProps {
  type?: InputType;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  validation?: ValidationRule;
  suggestions?: string[]; // For search typeahead
  debounceMs?: number;
  rows?: number; // For multiline
  showSubmit?: boolean;
  submitLabel?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onExecute?: (value: string) => void; // For expression mode
}

// Rayfall function suggestions for autocomplete
const RAYFALL_FUNCTIONS = [
  'select', 'update', 'delete', 'insert', 'upsert',
  'where', 'group-by', 'order-by', 'limit', 'offset',
  'sum', 'avg', 'min', 'max', 'count', 'distinct',
  'first', 'last', 'til', 'range', 'take', 'drop',
  'asc', 'desc', 'by', 'and', 'or', 'not',
  'like', 'in', 'between', 'null?', 'type',
  'cols', 'meta', 'tables', 'table',
  'join', 'lj', 'ij', 'uj', 'aj', 'wj',
  'flip', 'enlist', 'raze', 'reverse',
  'string', 'int', 'float', 'date', 'time', 'timestamp',
  'read-csv', 'save', 'load', 'show',
  '+', '-', '*', '/', '%', '=', '!=', '<', '>', '<=', '>=',
];

export function TextInput({
  type = 'text',
  label,
  placeholder,
  defaultValue = '',
  validation,
  suggestions = [],
  debounceMs = 300,
  rows = 4,
  showSubmit = false,
  submitLabel = 'Submit',
  onChange,
  onSubmit,
  onExecute,
}: TextInputProps) {
  const { bridge, status } = useRayLensStore();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  
  // Expression mode state
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [result, setResult] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Default placeholders by type
  const defaultPlaceholders: Record<InputType, string> = {
    text: 'Enter text...',
    number: 'Enter number...',
    expression: '(+ 1 1) or (select {from: trades})...',
    search: 'Type to search...',
    multiline: 'Enter text...',
  };

  // Validate value
  const validate = useCallback((val: string): string | null => {
    if (!validation) return null;

    if (validation.required && !val.trim()) {
      return 'This field is required';
    }

    if (validation.minLength && val.length < validation.minLength) {
      return `Minimum ${validation.minLength} characters required`;
    }

    if (validation.maxLength && val.length > validation.maxLength) {
      return `Maximum ${validation.maxLength} characters allowed`;
    }

    if (type === 'number' && val.trim()) {
      const num = parseFloat(val);
      if (isNaN(num)) {
        return 'Please enter a valid number';
      }
      if (validation.min !== undefined && num < validation.min) {
        return `Minimum value is ${validation.min}`;
      }
      if (validation.max !== undefined && num > validation.max) {
        return `Maximum value is ${validation.max}`;
      }
    }

    if (validation.pattern && val.trim() && !validation.pattern.test(val)) {
      return validation.patternMessage || 'Invalid format';
    }

    if (validation.custom) {
      return validation.custom(val);
    }

    return null;
  }, [validation, type]);

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (type === 'search' && value.trim()) {
      return suggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10);
    }
    if (type === 'expression' && value.trim()) {
      // Get the last word for autocomplete
      const match = value.match(/[a-z-]+$/i);
      if (match) {
        const lastWord = match[0].toLowerCase();
        return RAYFALL_FUNCTIONS.filter(f => 
          f.toLowerCase().startsWith(lastWord)
        ).slice(0, 8);
      }
    }
    return [];
  }, [type, value, suggestions]);

  // Handle value change with debounce
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    setHistoryIndex(-1);
    
    // Clear previous execution results
    if (type === 'expression') {
      setResult(null);
      setExecutionError(null);
    }

    // Show suggestions
    if ((type === 'search' || type === 'expression') && newValue.trim()) {
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
    }

    // Validate on change
    if (touched) {
      setError(validate(newValue));
    }

    // Debounced onChange callback
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      onChange?.(newValue);
    }, debounceMs);
  }, [type, touched, validate, onChange, debounceMs]);

  // Handle blur
  const handleBlur = () => {
    setTouched(true);
    setError(validate(value));
    // Delay hiding suggestions to allow click
    setTimeout(() => setShowSuggestions(false), 200);
  };

  // Handle suggestion selection
  const selectSuggestion = useCallback((suggestion: string) => {
    if (type === 'expression') {
      // Replace last word with suggestion
      const newValue = value.replace(/[a-z-]+$/i, suggestion);
      setValue(newValue);
      inputRef.current?.focus();
    } else {
      setValue(suggestion);
      onChange?.(suggestion);
    }
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, [type, value, onChange]);

  // Execute expression
  const handleExecute = useCallback(async () => {
    if (!value.trim()) return;

    if (type === 'expression') {
      // Add to history
      setHistory((prev) => {
        const filtered = prev.filter((h) => h !== value);
        return [value, ...filtered].slice(0, 50);
      });
      setHistoryIndex(-1);

      // Execute via Rayforce
      if (bridge && status === 'ready') {
        setIsExecuting(true);
        setExecutionError(null);
        setResult(null);

        try {
          const res = await bridge.eval(value);
          setResult(String(res));
        } catch (err) {
          setExecutionError(err instanceof Error ? err.message : 'Execution failed');
        } finally {
          setIsExecuting(false);
        }
      } else {
        setExecutionError('Rayforce not connected');
      }
    }

    onExecute?.(value);
  }, [value, type, bridge, status, onExecute]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    const validationError = validate(value);
    setError(validationError);
    setTouched(true);

    if (!validationError) {
      onSubmit?.(value);
    }
  }, [value, validate, onSubmit]);

  // Handle keydown
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Suggestion navigation
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          Math.min(prev + 1, filteredSuggestions.length - 1)
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(filteredSuggestions[selectedSuggestionIndex]!);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    // History navigation for expression mode
    if (type === 'expression' && history.length > 0 && !showSuggestions) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setValue(history[newIndex] ?? '');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.max(historyIndex - 1, -1);
        setHistoryIndex(newIndex);
        setValue(newIndex === -1 ? '' : (history[newIndex] ?? ''));
        return;
      }
    }

    // Execute/Submit on Enter
    if (e.key === 'Enter' && !e.shiftKey && type !== 'multiline') {
      e.preventDefault();
      if (type === 'expression') {
        handleExecute();
      } else if (showSubmit) {
        handleSubmit();
      }
    }
  }, [
    showSuggestions, filteredSuggestions, selectedSuggestionIndex, selectSuggestion,
    type, history, historyIndex, handleExecute, handleSubmit, showSubmit
  ]);

  // Clear all
  const handleClear = () => {
    setValue('');
    setError(null);
    setResult(null);
    setExecutionError(null);
    onChange?.('');
    inputRef.current?.focus();
    textareaRef.current?.focus();
  };

  // Clear history
  const clearHistory = () => {
    setHistory([]);
    setHistoryIndex(-1);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Get icon for type
  const getIcon = () => {
    switch (type) {
      case 'search':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'expression':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'number':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        );
      default:
        return null;
    }
  };

  const hasIcon = type === 'search' || type === 'expression' || type === 'number';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">{getIcon()}</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {label || (type === 'expression' ? 'Rayfall Console' : type === 'search' ? 'Search' : type === 'multiline' ? 'Text Editor' : 'Input')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {type === 'expression' && history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-2xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear history
            </button>
          )}
          {value && (
            <button
              onClick={handleClear}
              className="text-2xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-2 relative">
        {type === 'multiline' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? defaultPlaceholders[type]}
            rows={rows}
            className={`w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none resize-y font-mono ${
              error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
        ) : (
          <div className="relative">
            {hasIcon && (
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                {getIcon()}
              </span>
            )}
            <input
              ref={inputRef}
              type={type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? defaultPlaceholders[type]}
              className={`w-full py-1.5 bg-gray-100 dark:bg-gray-800 border rounded text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-ray-500 focus:outline-none ${
                hasIcon ? 'pl-9 pr-2' : 'px-3'
              } ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} ${
                type === 'expression' ? 'font-mono pr-16' : ''
              }`}
            />
            {type === 'expression' && value && (
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-ray-600 hover:bg-ray-500 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white text-2xs rounded transition-colors"
              >
                {isExecuting ? '...' : 'Run'}
              </button>
            )}
          </div>
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-20 left-2 right-2 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.map((suggestion, idx) => (
              <button
                key={suggestion}
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                  idx === selectedSuggestionIndex
                    ? 'bg-ray-500/20 text-ray-600 dark:text-ray-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${type === 'expression' ? 'font-mono' : ''}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Validation error */}
        {error && touched && (
          <div className="mt-1 text-2xs text-red-500 dark:text-red-400">{error}</div>
        )}
      </div>

      {/* History (expression mode) */}
      {type === 'expression' && history.length > 0 && (
        <div className="px-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="text-2xs text-gray-500 mb-1">History (↑/↓):</div>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {history.slice(0, 10).map((h, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setValue(h);
                  inputRef.current?.focus();
                }}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-2xs font-mono truncate max-w-full transition-colors"
              >
                {h.length > 30 ? h.substring(0, 30) + '...' : h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result/Error display (expression mode) */}
      {type === 'expression' && (result || executionError) && (
        <div className="flex-1 p-2 overflow-auto">
          {executionError ? (
            <div className="px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded">
              <div className="text-2xs text-red-600 dark:text-red-400 font-medium mb-0.5">Error</div>
              <div className="text-2xs text-red-500 dark:text-red-300 font-mono break-all">{executionError}</div>
            </div>
          ) : result ? (
            <div className="px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium">Result</span>
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="text-2xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Copy
                </button>
              </div>
              <pre className="text-2xs text-emerald-500 dark:text-emerald-300 font-mono whitespace-pre-wrap break-all">
                {result}
              </pre>
            </div>
          ) : null}
        </div>
      )}

      {/* Submit button (non-expression modes) */}
      {showSubmit && type !== 'expression' && (
        <div className="px-2 pb-2">
          <button
            onClick={handleSubmit}
            disabled={!!error || !value.trim()}
            className="w-full px-3 py-1.5 bg-ray-600 hover:bg-ray-500 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600 text-white text-xs font-medium rounded transition-colors"
          >
            {submitLabel}
          </button>
        </div>
      )}

      {/* Character count (for multiline with maxLength) */}
      {type === 'multiline' && validation?.maxLength && (
        <div className="px-2 pb-1 text-2xs text-gray-500 text-right">
          {value.length} / {validation.maxLength}
        </div>
      )}

      {/* Status footer */}
      <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 flex items-center justify-between mt-auto">
        {type === 'expression' ? (
          <>
            <span className="text-2xs text-gray-500">
              {bridge && status === 'ready' ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Disconnected
                </span>
              )}
            </span>
            <span className="text-2xs text-gray-500">
              Enter to execute • Tab for autocomplete
            </span>
          </>
        ) : type === 'search' ? (
          <span className="text-2xs text-gray-500">
            {filteredSuggestions.length > 0 
              ? `${filteredSuggestions.length} matches` 
              : 'Type to search'
            }
          </span>
        ) : type === 'number' ? (
          <span className="text-2xs text-gray-500">
            {validation?.min !== undefined && validation?.max !== undefined
              ? `Range: ${validation.min} - ${validation.max}`
              : 'Enter a number'
            }
          </span>
        ) : (
          <span className="text-2xs text-gray-500">
            {validation?.required ? 'Required' : 'Optional'}
          </span>
        )}
      </div>
    </div>
  );
}
