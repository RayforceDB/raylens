/**
 * MarksCard - Visual encoding controls (Color, Size, Label, etc.)
 * Similar to Tableau's Marks card
 */

import { useState } from 'react';
import type { Field } from '../data/DataPanel';
import type { EncodedField } from './EncodingShelf';

type ChartType = 'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'heatmap';

interface MarksCardProps {
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  colorField?: EncodedField;
  sizeField?: EncodedField;
  labelField?: EncodedField;
  onColorChange: (field: Field | null) => void;
  onSizeChange: (field: Field | null) => void;
  onLabelChange: (field: Field | null) => void;
}

function ChartTypeButton({
  type,
  active,
  onClick,
  children,
}: {
  type: ChartType;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-gray-700 text-white'
          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
      }`}
      title={type.charAt(0).toUpperCase() + type.slice(1)}
    >
      {children}
    </button>
  );
}

interface DropZoneProps {
  label: string;
  icon: React.ReactNode;
  field: EncodedField | undefined;
  onDrop: (field: Field) => void;
  onClear: () => void;
}

function DropZone({ label, icon, field, onDrop, onClear }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        onDrop(JSON.parse(data) as Field);
      } catch {
        console.error('Invalid drop data');
      }
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`flex items-center gap-2 p-1.5 rounded border transition-colors ${
        isDragOver
          ? 'border-ray-500 bg-ray-500/10'
          : 'border-transparent hover:bg-gray-800/50'
      }`}
    >
      <span className="text-gray-500">{icon}</span>
      {field ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-sm text-gray-300 truncate">{field.name}</span>
          <button
            onClick={onClear}
            className="shrink-0 text-gray-500 hover:text-gray-300"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <span className="text-xs text-gray-500">{label}</span>
      )}
    </div>
  );
}

export function MarksCard({
  chartType,
  onChartTypeChange,
  colorField,
  sizeField,
  labelField,
  onColorChange,
  onSizeChange,
  onLabelChange,
}: MarksCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Marks
      </h3>

      {/* Chart type selector */}
      <div className="flex items-center gap-1 mb-4 pb-3 border-b border-gray-800">
        <ChartTypeButton
          type="bar"
          active={chartType === 'bar'}
          onClick={() => onChartTypeChange('bar')}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="10" width="4" height="10" rx="1" />
            <rect x="10" y="6" width="4" height="14" rx="1" />
            <rect x="16" y="2" width="4" height="18" rx="1" />
          </svg>
        </ChartTypeButton>

        <ChartTypeButton
          type="line"
          active={chartType === 'line'}
          onClick={() => onChartTypeChange('line')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 18l4-4 4 4 8-12" />
          </svg>
        </ChartTypeButton>

        <ChartTypeButton
          type="area"
          active={chartType === 'area'}
          onClick={() => onChartTypeChange('area')}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 18l4-4 4 4 8-12v14H4v-2z" opacity="0.5" />
            <path fill="none" stroke="currentColor" strokeWidth={2} d="M4 18l4-4 4 4 8-12" />
          </svg>
        </ChartTypeButton>

        <ChartTypeButton
          type="scatter"
          active={chartType === 'scatter'}
          onClick={() => onChartTypeChange('scatter')}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="6" cy="14" r="2" />
            <circle cx="10" cy="8" r="2" />
            <circle cx="14" cy="16" r="2" />
            <circle cx="18" cy="6" r="2" />
          </svg>
        </ChartTypeButton>

        <ChartTypeButton
          type="pie"
          active={chartType === 'pie'}
          onClick={() => onChartTypeChange('pie')}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8v8l5.66 5.66C14.32 18.79 13.22 20 12 20z" />
          </svg>
        </ChartTypeButton>

        <ChartTypeButton
          type="heatmap"
          active={chartType === 'heatmap'}
          onClick={() => onChartTypeChange('heatmap')}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="2" y="2" width="5" height="5" opacity="0.3" />
            <rect x="9" y="2" width="5" height="5" opacity="0.6" />
            <rect x="16" y="2" width="5" height="5" opacity="0.9" />
            <rect x="2" y="9" width="5" height="5" opacity="0.5" />
            <rect x="9" y="9" width="5" height="5" opacity="0.8" />
            <rect x="16" y="9" width="5" height="5" opacity="0.4" />
            <rect x="2" y="16" width="5" height="5" opacity="0.7" />
            <rect x="9" y="16" width="5" height="5" opacity="0.4" />
            <rect x="16" y="16" width="5" height="5" opacity="0.6" />
          </svg>
        </ChartTypeButton>
      </div>

      {/* Visual encoding drop zones */}
      <div className="space-y-1">
        <DropZone
          label="Color"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          }
          field={colorField}
          onDrop={(f) => onColorChange(f)}
          onClear={() => onColorChange(null)}
        />

        <DropZone
          label="Size"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          }
          field={sizeField}
          onDrop={(f) => onSizeChange(f)}
          onClear={() => onSizeChange(null)}
        />

        <DropZone
          label="Label"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          }
          field={labelField}
          onDrop={(f) => onLabelChange(f)}
          onClear={() => onLabelChange(null)}
        />
      </div>
    </div>
  );
}
