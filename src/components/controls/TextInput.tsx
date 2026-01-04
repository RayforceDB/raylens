/**
 * TextInput - Text input control for Rayfall expressions or search
 */

import { useState, useCallback, useRef } from 'react';
import { useRayLensStore } from '@core/store';

interface TextInputProps {
  mode?: 'search' | 'expression' | 'value';
  placeholder?: string;
  onChange?: (value: string) => void;
  onExecute?: (value: string) => void;
}

export function TextInput({
  mode = 'search',
  placeholder,
  onChange,
  onExecute,
}: TextInputProps) {
  const { bridge, status } = useRayLensStore();
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultPlaceholders: Record<string, string> = {
    search: 'Search...',
    expression: '(+ 1 1) or (til 10)...',
    value: 'Enter value...',
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setHistoryIndex(-1);
    onChange?.(newValue);
    
    // Clear previous result/error on change
    if (mode === 'expression') {
      setResult(null);
      setError(null);
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // History navigation
      if (mode === 'expression' && history.length > 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          setValue(history[newIndex] ?? '');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = Math.max(historyIndex - 1, -1);
          setHistoryIndex(newIndex);
          setValue(newIndex === -1 ? '' : (history[newIndex] ?? ''));
        }
      }

      // Execute on Enter
      if (e.key === 'Enter' && value.trim()) {
        handleExecute();
      }
    },
    [mode, history, historyIndex, value]
  );

  const handleExecute = useCallback(async () => {
    if (!value.trim()) return;

    if (mode === 'expression') {
      // Add to history
      setHistory((prev) => {
        const filtered = prev.filter((h) => h !== value);
        return [value, ...filtered].slice(0, 50); // Keep last 50
      });
      setHistoryIndex(-1);

      // Execute via Rayforce
      if (bridge && status === 'ready') {
        setIsExecuting(true);
        setError(null);
        setResult(null);

        try {
          const res = await bridge.eval(value);
          setResult(String(res));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Execution failed');
        } finally {
          setIsExecuting(false);
        }
      } else {
        setError('Rayforce not connected');
      }
    }

    onExecute?.(value);
  }, [value, mode, bridge, status, onExecute]);

  const clearHistory = () => {
    setHistory([]);
    setHistoryIndex(-1);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-300">
          {mode === 'expression' ? 'q Console' : mode === 'search' ? 'Search' : 'Input'}
        </span>
        {mode === 'expression' && history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-2xs text-gray-500 hover:text-gray-300"
          >
            Clear history
          </button>
        )}
      </div>

      {/* Input */}
      <div className="p-2">
        <div className="relative">
          {mode === 'search' && (
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? defaultPlaceholders[mode]}
            className={`w-full py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 placeholder-gray-600 focus:border-ray-500 focus:outline-none ${
              mode === 'search' ? 'pl-8 pr-2' : 'px-2'
            } ${mode === 'expression' ? 'font-mono' : ''}`}
          />
          {mode === 'expression' && value && (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-ray-600 hover:bg-ray-500 disabled:bg-gray-700 text-white text-2xs rounded transition-colors"
            >
              {isExecuting ? '...' : 'Run'}
            </button>
          )}
        </div>
      </div>

      {/* History (expression mode) */}
      {mode === 'expression' && history.length > 0 && (
        <div className="px-2 pb-2 border-b border-gray-700">
          <div className="text-2xs text-gray-500 mb-1">History (↑/↓):</div>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {history.slice(0, 10).map((h, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setValue(h);
                  inputRef.current?.focus();
                }}
                className="px-1.5 py-0.5 bg-gray-800 text-gray-400 hover:text-gray-300 rounded text-2xs font-mono truncate max-w-full"
              >
                {h.length > 30 ? h.substring(0, 30) + '...' : h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result/Error display (expression mode) */}
      {mode === 'expression' && (result || error) && (
        <div className="flex-1 p-2 overflow-auto">
          {error ? (
            <div className="px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded">
              <div className="text-2xs text-red-400 font-medium mb-0.5">Error</div>
              <div className="text-2xs text-red-300 font-mono break-all">{error}</div>
            </div>
          ) : result ? (
            <div className="px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
              <div className="text-2xs text-emerald-400 font-medium mb-0.5">Result</div>
              <pre className="text-2xs text-emerald-300 font-mono whitespace-pre-wrap break-all">
                {result}
              </pre>
            </div>
          ) : null}
        </div>
      )}

      {/* Status */}
      <div className="px-2 py-1.5 border-t border-gray-700 bg-gray-800/30 flex items-center justify-between">
        {mode === 'expression' ? (
          <>
            <span className="text-2xs text-gray-500">
              {bridge && status === 'ready' ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Disconnected
                </span>
              )}
            </span>
            <span className="text-2xs text-gray-600">Press Enter to execute</span>
          </>
        ) : (
          <span className="text-2xs text-gray-600">
            {mode === 'search' ? 'Type to search' : 'Enter value'}
          </span>
        )}
      </div>
    </div>
  );
}
