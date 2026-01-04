/**
 * EncodingShelf - Drop targets for field encoding (Columns, Rows, etc.)
 * Similar to Tableau's encoding shelves
 */

import { useState } from 'react';
import type { Field } from '../data/DataPanel';

export interface EncodedField {
  name: string;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countd';
  sortOrder?: 'asc' | 'desc' | 'none';
}

interface FieldPillProps {
  field: EncodedField;
  onRemove: () => void;
  onAggregationChange: ((agg: EncodedField['aggregation']) => void) | undefined;
  color?: 'blue' | 'green' | 'default';
}

function FieldPill({ field, onRemove, onAggregationChange, color = 'default' }: FieldPillProps) {
  const [showMenu, setShowMenu] = useState(false);

  const colorClasses = {
    blue: 'bg-blue-600 text-white',
    green: 'bg-emerald-600 text-white',
    default: 'bg-gray-700 text-gray-200',
  };

  const displayName = field.aggregation 
    ? `${field.aggregation.toUpperCase()}(${field.name})`
    : field.name;

  return (
    <div className="relative">
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium ${colorClasses[color]} cursor-pointer`}
        onClick={() => setShowMenu(!showMenu)}
      >
        <span className="truncate max-w-[150px]">{displayName}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:bg-white/20 rounded p-0.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Aggregation menu */}
      {showMenu && onAggregationChange && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[120px]">
            {(['sum', 'avg', 'min', 'max', 'count', 'countd'] as const).map((agg) => (
              <button
                key={agg}
                onClick={() => {
                  onAggregationChange(agg);
                  setShowMenu(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 ${
                  field.aggregation === agg ? 'text-ray-400' : 'text-gray-300'
                }`}
              >
                {agg.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface EncodingShelfProps {
  label: string;
  fields: EncodedField[];
  onDrop: (field: Field) => void;
  onRemove: (index: number) => void;
  onAggregationChange?: (index: number, agg: EncodedField['aggregation']) => void;
  color?: 'blue' | 'green' | 'default';
  multiple?: boolean;
}

export function EncodingShelf({
  label,
  fields,
  onDrop,
  onRemove,
  onAggregationChange,
  color = 'default',
  multiple = true,
}: EncodingShelfProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const field = JSON.parse(data) as Field;
        if (!multiple && fields.length >= 1) {
          onRemove(0);
        }
        onDrop(field);
      } catch {
        console.error('Invalid drop data');
      }
    }
  };

  return (
    <div className="flex items-start gap-3">
      <span className="w-20 text-xs font-medium text-gray-400 pt-1.5 text-right shrink-0">
        {label}
      </span>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 min-h-[36px] flex items-center gap-2 flex-wrap p-1.5 rounded border-2 border-dashed transition-colors ${
          isDragOver
            ? 'border-ray-500 bg-ray-500/10'
            : fields.length > 0
            ? 'border-transparent bg-gray-800/50'
            : 'border-gray-700 bg-gray-800/30'
        }`}
      >
        {fields.map((field, index) => (
          <FieldPill
            key={`${field.name}-${index}`}
            field={field}
            onRemove={() => onRemove(index)}
            onAggregationChange={
              onAggregationChange
                ? (agg) => onAggregationChange(index, agg)
                : undefined
            }
            color={color}
          />
        ))}
        {fields.length === 0 && (
          <span className="text-xs text-gray-500 px-2">Drop field here</span>
        )}
      </div>
    </div>
  );
}
