/**
 * RangeSlider - Range selection slider component
 * 
 * Based on KX Dashboards slider component with:
 * - Single value or range (dual thumb) mode
 * - Configurable min/max/step
 * - Tick marks and labels
 * - Data binding to filter other components
 * - Histogram distribution overlay
 * - Touch-friendly handles
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRayLensStore } from '@core/store';

interface RangeSliderProps {
  title?: string;
  mode?: 'single' | 'range';
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number | [number, number];
  showTicks?: boolean;
  tickCount?: number;
  showValue?: boolean;
  showHistogram?: boolean;
  histogramData?: number[];
  column?: string; // Column name for data binding
  format?: (value: number) => string;
  onChange?: (value: number | [number, number]) => void;
  onChangeEnd?: (value: number | [number, number]) => void;
}

export function RangeSlider({
  title,
  mode = 'range',
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  showTicks = true,
  tickCount = 5,
  showValue = true,
  showHistogram = false,
  histogramData,
  column,
  format = (v) => v.toLocaleString(),
  onChange,
  onChangeEnd,
}: RangeSliderProps) {
  const { bridge, status } = useRayLensStore();
  
  // Initialize values
  const [values, setValues] = useState<[number, number]>(() => {
    if (defaultValue !== undefined) {
      return Array.isArray(defaultValue) ? defaultValue : [min, defaultValue];
    }
    return mode === 'range' ? [min, max] : [min, (min + max) / 2];
  });
  
  const [activeThumb, setActiveThumb] = useState<'start' | 'end' | null>(null);
  const [computedHistogram, setComputedHistogram] = useState<number[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);

  // Load histogram data from Rayforce if column specified
  useEffect(() => {
    async function fetchHistogram() {
      if (!column || !bridge || status !== 'ready') return;

      try {
        // Get histogram bins using Rayforce
        const result = await bridge.eval(`(histogram ${column} 20)`);
        console.log('[RangeSlider] Histogram result:', result);
        
        // Parse result - expecting list of counts
        const match = String(result).match(/[\[(]([\d\s.]+)[\])]/);
        if (match && match[1]) {
          const nums = match[1].split(/\s+/).filter(Boolean).map(Number);
          setComputedHistogram(nums);
        }
      } catch (err) {
        console.error('[RangeSlider] Histogram query failed:', err);
      }
    }

    fetchHistogram();
  }, [column, bridge, status]);

  // Use provided or computed histogram
  const histogram = histogramData || computedHistogram;

  // Generate ticks
  const ticks = useMemo(() => {
    const result: number[] = [];
    const tickStep = (max - min) / (tickCount - 1);
    for (let i = 0; i < tickCount; i++) {
      result.push(min + tickStep * i);
    }
    return result;
  }, [min, max, tickCount]);

  // Calculate position from value
  const valueToPercent = (value: number): number => {
    return ((value - min) / (max - min)) * 100;
  };

  // Calculate value from position
  const percentToValue = (percent: number): number => {
    const raw = min + (percent / 100) * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.min(Math.max(stepped, min), max);
  };

  // Handle drag
  const handleMove = useCallback((clientX: number) => {
    if (!trackRef.current || !activeThumb) return;

    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 0), 100);
    const newValue = percentToValue(percent);

    setValues(prev => {
      let newValues: [number, number];
      
      if (mode === 'single') {
        newValues = [prev[0], newValue];
      } else if (activeThumb === 'start') {
        newValues = [Math.min(newValue, prev[1] - step), prev[1]];
      } else {
        newValues = [prev[0], Math.max(newValue, prev[0] + step)];
      }

      onChange?.(mode === 'single' ? newValues[1] : newValues);
      return newValues;
    });
  }, [activeThumb, mode, step, min, max, onChange]);

  // Mouse/touch handlers
  const handlePointerDown = (thumb: 'start' | 'end') => (e: React.PointerEvent) => {
    e.preventDefault();
    setActiveThumb(thumb);
    
    const handlePointerMove = (e: PointerEvent) => {
      handleMove(e.clientX);
    };

    const handlePointerUp = () => {
      setActiveThumb(null);
      onChangeEnd?.(mode === 'single' ? values[1] : values);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  // Track click handler
  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    const newValue = percentToValue(percent);

    if (mode === 'single') {
      const newValues: [number, number] = [values[0], newValue];
      setValues(newValues);
      onChange?.(newValue);
      onChangeEnd?.(newValue);
    } else {
      // Click closer to which thumb?
      const distToStart = Math.abs(valueToPercent(values[0]) - percent);
      const distToEnd = Math.abs(valueToPercent(values[1]) - percent);

      setValues(prev => {
        const newValues: [number, number] = distToStart < distToEnd
          ? [Math.min(newValue, prev[1] - step), prev[1]]
          : [prev[0], Math.max(newValue, prev[0] + step)];
        onChange?.(newValues);
        onChangeEnd?.(newValues);
        return newValues;
      });
    }
  };

  // Get Rayfall expression for the current range
  const rayfallExpr = useMemo(() => {
    if (!column) return '';
    if (mode === 'single') {
      return `(= ${column} ${values[1]})`;
    }
    return `(and (>= ${column} ${values[0]}) (<= ${column} ${values[1]}))`;
  }, [column, mode, values]);

  const startPercent = valueToPercent(values[0]);
  const endPercent = valueToPercent(values[1]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-ray-600 dark:text-ray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {title || 'Range'}
          </span>
        </div>
        {showValue && (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {mode === 'single' ? format(values[1]) : `${format(values[0])} — ${format(values[1])}`}
          </span>
        )}
      </div>

      {/* Slider content */}
      <div className="flex-1 p-4 flex flex-col justify-center">
        {/* Histogram overlay */}
        {showHistogram && histogram.length > 0 && (
          <div className="flex items-end justify-between h-10 mb-2 px-2">
            {histogram.map((count, i) => {
              const maxCount = Math.max(...histogram);
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const binStart = min + (i / histogram.length) * (max - min);
              const binEnd = min + ((i + 1) / histogram.length) * (max - min);
              const isInRange = mode === 'range'
                ? binEnd >= values[0] && binStart <= values[1]
                : binStart <= values[1];

              return (
                <div
                  key={i}
                  className={`flex-1 mx-px rounded-t transition-colors ${
                    isInRange
                      ? 'bg-ray-500/40'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              );
            })}
          </div>
        )}

        {/* Track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
        >
          {/* Selected range */}
          <div
            className="absolute h-full bg-ray-500 rounded-full"
            style={{
              left: mode === 'range' ? `${startPercent}%` : '0%',
              width: mode === 'range' ? `${endPercent - startPercent}%` : `${endPercent}%`,
            }}
          />

          {/* Start thumb (range mode only) */}
          {mode === 'range' && (
            <div
              onPointerDown={handlePointerDown('start')}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-ray-500 rounded-full cursor-grab shadow-md transition-transform ${
                activeThumb === 'start' ? 'scale-110 cursor-grabbing' : 'hover:scale-105'
              }`}
              style={{ left: `${startPercent}%` }}
            >
              {showValue && activeThumb === 'start' && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-700 text-white text-2xs rounded whitespace-nowrap">
                  {format(values[0])}
                </div>
              )}
            </div>
          )}

          {/* End thumb */}
          <div
            onPointerDown={handlePointerDown('end')}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-ray-500 rounded-full cursor-grab shadow-md transition-transform ${
              activeThumb === 'end' ? 'scale-110 cursor-grabbing' : 'hover:scale-105'
            }`}
            style={{ left: `${endPercent}%` }}
          >
            {showValue && activeThumb === 'end' && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 dark:bg-gray-700 text-white text-2xs rounded whitespace-nowrap">
                {format(values[1])}
              </div>
            )}
          </div>
        </div>

        {/* Tick marks */}
        {showTicks && (
          <div className="relative h-4 mt-2">
            {ticks.map((tick) => {
              const percent = valueToPercent(tick);
              return (
                <div
                  key={tick}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${percent}%` }}
                >
                  <div className="w-px h-1.5 bg-gray-300 dark:bg-gray-600 mx-auto" />
                  <div className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5 whitespace-nowrap">
                    {format(tick)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Column binding & Rayfall expression */}
      {column && (
        <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center justify-between text-2xs">
            <span className="text-gray-500">Column: <span className="text-gray-700 dark:text-gray-300">{column}</span></span>
          </div>
          <div className="text-2xs text-gray-500 mt-1">Rayfall:</div>
          <code className="text-2xs text-emerald-600 dark:text-emerald-400 break-all">{rayfallExpr}</code>
        </div>
      )}

      {/* Quick presets */}
      <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
        <div className="flex gap-1">
          <button
            onClick={() => {
              const newValues: [number, number] = [min, max];
              setValues(newValues);
              onChange?.(mode === 'single' ? max : newValues);
            }}
            className="px-2 py-0.5 text-2xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            All
          </button>
          <button
            onClick={() => {
              const mid = (min + max) / 2;
              const quarter = (max - min) / 4;
              const newValues: [number, number] = [mid - quarter, mid + quarter];
              setValues(newValues);
              onChange?.(mode === 'single' ? mid : newValues);
            }}
            className="px-2 py-0.5 text-2xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Middle 50%
          </button>
          <button
            onClick={() => {
              const newValues: [number, number] = [min, min + (max - min) * 0.25];
              setValues(newValues);
              onChange?.(mode === 'single' ? newValues[1] : newValues);
            }}
            className="px-2 py-0.5 text-2xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Bottom 25%
          </button>
          <button
            onClick={() => {
              const newValues: [number, number] = [min + (max - min) * 0.75, max];
              setValues(newValues);
              onChange?.(mode === 'single' ? newValues[1] : newValues);
            }}
            className="px-2 py-0.5 text-2xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Top 25%
          </button>
        </div>
      </div>
    </div>
  );
}
