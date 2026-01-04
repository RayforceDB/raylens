/**
 * GaugeControl - Visual gauge/meter display component
 * 
 * Based on KX Dashboards gauge component with:
 * - Multiple gauge types (radial, linear, semi-circle)
 * - Configurable ranges and thresholds
 * - Animated transitions
 * - Data-bound value from Rayforce
 * - Customizable colors and labels
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRayLensStore } from '@core/store';

type GaugeType = 'radial' | 'linear' | 'semicircle';

interface Threshold {
  value: number;
  color: string;
  label?: string;
}

interface GaugeControlProps {
  type?: GaugeType;
  title?: string;
  value?: number;
  expression?: string; // Rayfall expression to get value
  min?: number;
  max?: number;
  unit?: string;
  thresholds?: Threshold[];
  showValue?: boolean;
  showTicks?: boolean;
  tickCount?: number;
  animated?: boolean;
  refreshInterval?: number; // Auto-refresh in ms
}

// Default thresholds (green-yellow-red)
const DEFAULT_THRESHOLDS: Threshold[] = [
  { value: 60, color: '#22c55e', label: 'Normal' },
  { value: 80, color: '#eab308', label: 'Warning' },
  { value: 100, color: '#ef4444', label: 'Critical' },
];

export function GaugeControl({
  type = 'semicircle',
  title,
  value: propValue,
  expression,
  min = 0,
  max = 100,
  unit = '',
  thresholds = DEFAULT_THRESHOLDS,
  showValue = true,
  showTicks = true,
  tickCount = 5,
  animated = true,
  refreshInterval = 0,
}: GaugeControlProps) {
  const { bridge, status } = useRayLensStore();
  const [currentValue, setCurrentValue] = useState(propValue ?? 0);
  const [displayValue, setDisplayValue] = useState(propValue ?? 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Fetch value from Rayforce
  const fetchValue = useCallback(async () => {
    if (!expression || !bridge || status !== 'ready') return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await bridge.eval(expression);
      const num = parseFloat(String(result));
      if (!isNaN(num)) {
        setCurrentValue(num);
      } else {
        setError('Invalid value returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsLoading(false);
    }
  }, [expression, bridge, status]);

  // Fetch on mount and setup interval
  useEffect(() => {
    if (expression) {
      fetchValue();
      
      if (refreshInterval > 0) {
        intervalRef.current = window.setInterval(fetchValue, refreshInterval);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [expression, refreshInterval, fetchValue]);

  // Update from prop value
  useEffect(() => {
    if (propValue !== undefined) {
      setCurrentValue(propValue);
    }
  }, [propValue]);

  // Animate value changes
  useEffect(() => {
    if (!animated) {
      setDisplayValue(currentValue);
      return;
    }

    const startValue = displayValue;
    const endValue = currentValue;
    const duration = 500; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const newValue = startValue + (endValue - startValue) * eased;
      
      setDisplayValue(newValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentValue, animated]);

  // Get color for current value
  const getColorForValue = (val: number): string => {
    const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);
    for (const threshold of sortedThresholds) {
      if (val <= threshold.value) {
        return threshold.color;
      }
    }
    return sortedThresholds[sortedThresholds.length - 1]?.color ?? '#6b7280';
  };

  // Calculate percentage
  const percentage = useMemo(() => {
    const clamped = Math.min(Math.max(displayValue, min), max);
    return ((clamped - min) / (max - min)) * 100;
  }, [displayValue, min, max]);

  // Generate tick values
  const ticks = useMemo(() => {
    const result: number[] = [];
    const step = (max - min) / (tickCount - 1);
    for (let i = 0; i < tickCount; i++) {
      result.push(min + step * i);
    }
    return result;
  }, [min, max, tickCount]);

  const currentColor = getColorForValue(displayValue);

  // Render semi-circle gauge
  const renderSemicircle = () => {
    const radius = 80;
    const strokeWidth = 12;
    const centerX = 100;
    const centerY = 90;
    const circumference = Math.PI * radius;
    const offset = circumference * (1 - percentage / 100);

    return (
      <svg viewBox="0 0 200 120" className="w-full max-w-[200px] mx-auto">
        {/* Background arc */}
        <path
          d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        
        {/* Value arc */}
        <path
          d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
          fill="none"
          stroke={currentColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* Center value */}
        {showValue && (
          <text
            x={centerX}
            y={centerY - 10}
            textAnchor="middle"
            className="fill-gray-800 dark:fill-gray-100 text-2xl font-bold"
            style={{ fontSize: '28px' }}
          >
            {Math.round(displayValue)}
          </text>
        )}
        
        {/* Unit */}
        {unit && (
          <text
            x={centerX}
            y={centerY + 10}
            textAnchor="middle"
            className="fill-gray-500 dark:fill-gray-400 text-xs"
            style={{ fontSize: '12px' }}
          >
            {unit}
          </text>
        )}

        {/* Ticks */}
        {showTicks && ticks.map((tick, i) => {
          const angle = Math.PI - (i / (tickCount - 1)) * Math.PI;
          const x = centerX + (radius + 18) * Math.cos(angle);
          const y = centerY - (radius + 18) * Math.sin(angle);
          return (
            <text
              key={tick}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-gray-400 dark:fill-gray-500"
              style={{ fontSize: '9px' }}
            >
              {tick}
            </text>
          );
        })}
      </svg>
    );
  };

  // Render radial gauge
  const renderRadial = () => {
    const radius = 70;
    const strokeWidth = 10;
    const centerX = 90;
    const centerY = 90;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - percentage / 100);

    return (
      <svg viewBox="0 0 180 180" className="w-full max-w-[180px] mx-auto">
        {/* Background circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        
        {/* Value arc */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke={currentColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${centerX} ${centerY})`}
          className="transition-all duration-300"
        />

        {/* Center value */}
        {showValue && (
          <>
            <text
              x={centerX}
              y={centerY - 5}
              textAnchor="middle"
              className="fill-gray-800 dark:fill-gray-100 font-bold"
              style={{ fontSize: '24px' }}
            >
              {Math.round(displayValue)}
            </text>
            {unit && (
              <text
                x={centerX}
                y={centerY + 15}
                textAnchor="middle"
                className="fill-gray-500 dark:fill-gray-400"
                style={{ fontSize: '11px' }}
              >
                {unit}
              </text>
            )}
          </>
        )}
      </svg>
    );
  };

  // Render linear gauge
  const renderLinear = () => {
    return (
      <div className="w-full px-4 py-2">
        {/* Value display */}
        {showValue && (
          <div className="text-center mb-2">
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {Math.round(displayValue)}
            </span>
            {unit && <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{unit}</span>}
          </div>
        )}

        {/* Progress bar */}
        <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              backgroundColor: currentColor,
            }}
          />
          
          {/* Threshold markers */}
          {thresholds.map((threshold) => {
            const pos = ((threshold.value - min) / (max - min)) * 100;
            return (
              <div
                key={threshold.value}
                className="absolute top-0 w-0.5 h-full bg-white/50"
                style={{ left: `${pos}%` }}
              />
            );
          })}
        </div>

        {/* Tick labels */}
        {showTicks && (
          <div className="flex justify-between mt-1 text-2xs text-gray-500 dark:text-gray-400">
            {ticks.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded overflow-hidden">
      {/* Header */}
      {title && (
        <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</span>
        </div>
      )}

      {/* Gauge */}
      <div className="flex-1 flex items-center justify-center p-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-4 h-4 border-2 border-ray-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-center p-2">
            <div className="text-red-500 dark:text-red-400 text-xs">{error}</div>
            <button
              onClick={fetchValue}
              className="mt-2 text-2xs text-ray-600 dark:text-ray-400 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {type === 'semicircle' && renderSemicircle()}
            {type === 'radial' && renderRadial()}
            {type === 'linear' && renderLinear()}
          </>
        )}
      </div>

      {/* Legend */}
      {thresholds.length > 0 && (
        <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center justify-center gap-3">
            {thresholds.map((threshold) => (
              <div key={threshold.value} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: threshold.color }}
                />
                <span className="text-2xs text-gray-500 dark:text-gray-400">
                  {threshold.label || `≤${threshold.value}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
