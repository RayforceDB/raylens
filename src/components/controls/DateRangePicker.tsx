/**
 * DateRangePicker - Date range selector for time-series filtering
 * 
 * KX Dashboards-style date picker with:
 * - Quick presets (last X minutes/hours/days)
 * - Calendar presets (Today, Yesterday, This Week, etc.)
 * - Live mode with auto-refresh
 * - Custom date/time inputs
 * - Timezone display
 * 
 * @see https://code.kx.com/dashboards/datepicker/
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  onChange?: (range: DateRange) => void;
  onApply?: (rayfallExpr: string) => void;
  initialRange?: DateRange;
  showTimezone?: boolean;
  liveRefreshMs?: number;
  timestampColumn?: string;
}

// Relative presets (rolling window)
const RELATIVE_PRESETS = [
  { label: '5m', minutes: 5 },
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '4h', minutes: 240 },
  { label: '24h', minutes: 1440 },
  { label: '7d', minutes: 10080 },
  { label: '30d', minutes: 43200 },
] as const;

// Calendar presets (fixed dates)
const CALENDAR_PRESETS = [
  { label: 'Today', getRange: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end: now };
  }},
  { label: 'Yesterday', getRange: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end };
  }},
  { label: 'This Week', getRange: () => {
    const now = new Date();
    const day = now.getDay();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    return { start, end: now };
  }},
  { label: 'This Month', getRange: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  }},
] as const;

export function DateRangePicker({ 
  onChange, 
  onApply,
  initialRange,
  showTimezone = true,
  liveRefreshMs = 1000,
  timestampColumn = 'ts',
}: DateRangePickerProps) {
  const [range, setRange] = useState<DateRange>(
    initialRange ?? {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    }
  );
  const [activePreset, setActivePreset] = useState<number | null>(1440); // Default: Last 24 hours
  const [activeCalendarPreset, setActiveCalendarPreset] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [showCustom, setShowCustom] = useState(false);
  const liveIntervalRef = useRef<number | null>(null);

  // Live mode auto-refresh
  useEffect(() => {
    if (isLive && activePreset !== null) {
      liveIntervalRef.current = window.setInterval(() => {
        const end = new Date();
        const start = new Date(end.getTime() - activePreset * 60 * 1000);
        setRange({ start, end });
        // Don't call onChange on auto-refresh to avoid excessive updates
      }, liveRefreshMs);

      return () => {
        if (liveIntervalRef.current) {
          clearInterval(liveIntervalRef.current);
        }
      };
    }
  }, [isLive, activePreset, liveRefreshMs]);

  const applyPreset = useCallback((minutes: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);
    const newRange = { start, end };
    setRange(newRange);
    setActivePreset(minutes);
    setActiveCalendarPreset(null);
    setIsLive(true);
    onChange?.(newRange);
  }, [onChange]);

  const applyCalendarPreset = useCallback((presetName: string, getRange: () => DateRange) => {
    const newRange = getRange();
    setRange(newRange);
    setActivePreset(null);
    setActiveCalendarPreset(presetName);
    setIsLive(presetName === 'Today');
    onChange?.(newRange);
  }, [onChange]);

  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const start = new Date(e.target.value);
    if (!isNaN(start.getTime())) {
      const newRange = { ...range, start };
      setRange(newRange);
      setActivePreset(null);
      setActiveCalendarPreset(null);
      onChange?.(newRange);
    }
  }, [range, onChange]);

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const end = new Date(e.target.value);
    if (!isNaN(end.getTime())) {
      const newRange = { ...range, end };
      setRange(newRange);
      setActivePreset(null);
      setActiveCalendarPreset(null);
      setIsLive(false);
      onChange?.(newRange);
    }
  }, [range, onChange]);

  const toggleLive = useCallback(() => {
    if (!isLive) {
      const newRange = { ...range, end: new Date() };
      setRange(newRange);
      onChange?.(newRange);
    }
    setIsLive(!isLive);
  }, [isLive, range, onChange]);

  // Format for datetime-local input
  const formatForInput = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  // Format for display
  const formatDisplay = (date: Date) => {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get timezone abbreviation
  const timezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Generate Rayfall expression
  const rayfallExpr = useMemo(() => {
    const startStr = range.start.toISOString().replace('T', 'D').slice(0, 23);
    const endStr = range.end.toISOString().replace('T', 'D').slice(0, 23);
    return `(within ${timestampColumn} ${startStr} ${endStr})`;
  }, [range, timestampColumn]);

  const handleApply = useCallback(() => {
    if (rayfallExpr) {
      onApply?.(rayfallExpr);
    }
  }, [rayfallExpr, onApply]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-ray-600 dark:text-ray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Date Range</span>
        </div>
        <button
          onClick={toggleLive}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-2xs transition-colors ${
            isLive
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-gray-400 dark:bg-gray-600'}`} />
          Live
        </button>
      </div>

      {/* Current range display */}
      <div className="px-2 py-1.5 bg-ray-50 dark:bg-ray-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="text-2xs text-gray-600 dark:text-gray-400 flex items-center justify-between">
          <span>{formatDisplay(range.start)}</span>
          <span className="text-gray-400 dark:text-gray-600">→</span>
          <span>{isLive ? 'Now' : formatDisplay(range.end)}</span>
        </div>
      </div>

      {/* Relative presets (rolling window) */}
      <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="text-2xs text-gray-500 mb-1">Rolling Window</div>
        <div className="flex flex-wrap gap-1">
          {RELATIVE_PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              onClick={() => applyPreset(preset.minutes)}
              className={`px-2 py-1 rounded text-2xs transition-colors ${
                activePreset === preset.minutes
                  ? 'bg-ray-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar presets */}
      <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="text-2xs text-gray-500 mb-1">Calendar</div>
        <div className="flex flex-wrap gap-1">
          {CALENDAR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyCalendarPreset(preset.label, preset.getRange)}
              className={`px-2 py-1 rounded text-2xs transition-colors ${
                activeCalendarPreset === preset.label
                  ? 'bg-ray-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className={`px-2 py-1 rounded text-2xs transition-colors ${
              showCustom
                ? 'bg-ray-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom range inputs (collapsible) */}
      {showCustom && (
        <div className="p-2 space-y-2 border-b border-gray-200 dark:border-gray-700">
          <div>
            <label className="text-2xs text-gray-500 mb-1 block">Start</label>
            <input
              type="datetime-local"
              value={formatForInput(range.start)}
              onChange={handleStartChange}
              className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 focus:border-ray-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-2xs text-gray-500 mb-1 block">End {isLive && '(Live)'}</label>
            <input
              type="datetime-local"
              value={formatForInput(range.end)}
              onChange={handleEndChange}
              disabled={isLive}
              className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 focus:border-ray-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {/* Duration display */}
      <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 flex-1">
        <div className="flex items-center justify-between text-2xs mb-1">
          <span className="text-gray-500">Duration:</span>
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            {formatDuration(range.end.getTime() - range.start.getTime())}
          </span>
        </div>
        {showTimezone && (
          <div className="flex items-center justify-between text-2xs mb-2">
            <span className="text-gray-500">Timezone:</span>
            <span className="text-gray-600 dark:text-gray-400">{timezone}</span>
          </div>
        )}
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
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
