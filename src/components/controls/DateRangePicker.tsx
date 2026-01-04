/**
 * DateRangePicker - Date range selector for time-series filtering
 */

import { useState, useMemo } from 'react';

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  onChange?: (range: DateRange) => void;
  initialRange?: DateRange;
}

const PRESETS = [
  { label: 'Last 5 min', minutes: 5 },
  { label: 'Last 15 min', minutes: 15 },
  { label: 'Last 1 hour', minutes: 60 },
  { label: 'Last 4 hours', minutes: 240 },
  { label: 'Last 24 hours', minutes: 1440 },
  { label: 'Last 7 days', minutes: 10080 },
  { label: 'Last 30 days', minutes: 43200 },
] as const;

export function DateRangePicker({ onChange, initialRange }: DateRangePickerProps) {
  const [range, setRange] = useState<DateRange>(
    initialRange ?? {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    }
  );
  const [activePreset, setActivePreset] = useState<number | null>(1440); // Default: Last 24 hours
  const [isLive, setIsLive] = useState(true);

  const applyPreset = (minutes: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);
    const newRange = { start, end };
    setRange(newRange);
    setActivePreset(minutes);
    onChange?.(newRange);
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const start = new Date(e.target.value);
    if (!isNaN(start.getTime())) {
      const newRange = { ...range, start };
      setRange(newRange);
      setActivePreset(null);
      onChange?.(newRange);
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const end = new Date(e.target.value);
    if (!isNaN(end.getTime())) {
      const newRange = { ...range, end };
      setRange(newRange);
      setActivePreset(null);
      setIsLive(false);
      onChange?.(newRange);
    }
  };

  const toggleLive = () => {
    if (!isLive) {
      const newRange = { ...range, end: new Date() };
      setRange(newRange);
      onChange?.(newRange);
    }
    setIsLive(!isLive);
  };

  // Format for datetime-local input
  const formatForInput = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  // Generate Rayfall expression
  const rayfallExpr = useMemo(() => {
    const startStr = range.start.toISOString().replace('T', 'D').slice(0, 23);
    const endStr = range.end.toISOString().replace('T', 'D').slice(0, 23);
    return `(within ts ${startStr} ${endStr})`;
  }, [range]);

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-300">Date Range</span>
        <button
          onClick={toggleLive}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-2xs transition-colors ${
            isLive
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-gray-800 text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          Live
        </button>
      </div>

      {/* Presets */}
      <div className="px-2 py-2 border-b border-gray-700">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              onClick={() => applyPreset(preset.minutes)}
              className={`px-2 py-1 rounded text-2xs transition-colors ${
                activePreset === preset.minutes
                  ? 'bg-ray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom range inputs */}
      <div className="p-2 space-y-2 flex-1">
        <div>
          <label className="text-2xs text-gray-500 mb-1 block">Start</label>
          <input
            type="datetime-local"
            value={formatForInput(range.start)}
            onChange={handleStartChange}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 focus:border-ray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-2xs text-gray-500 mb-1 block">End</label>
          <input
            type="datetime-local"
            value={formatForInput(range.end)}
            onChange={handleEndChange}
            disabled={isLive}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 focus:border-ray-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {/* Duration display */}
      <div className="px-2 py-2 border-t border-gray-700 bg-gray-800/30">
        <div className="flex items-center justify-between text-2xs">
          <span className="text-gray-500">Duration:</span>
          <span className="text-gray-300">
            {formatDuration(range.end.getTime() - range.start.getTime())}
          </span>
        </div>
        <div className="text-2xs text-gray-500 mt-1">Rayfall:</div>
        <code className="text-2xs text-emerald-400 break-all">{rayfallExpr}</code>
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
