/**
 * DataPanel - Shows dimensions and measures from loaded dataset
 * Similar to Tableau's left data panel
 */

import { useMemo, useState } from 'react';
import { useRayLensStore } from '@core/store';

// Field metadata types
export interface Field {
  name: string;
  type: 'dimension' | 'measure';
  dataType: string;
  icon: 'text' | 'number' | 'date' | 'boolean' | 'geo';
}

// Field icons based on data type
function FieldIcon({ type }: { type: Field['icon'] }) {
  switch (type) {
    case 'text':
      return (
        <span className="text-blue-400 font-mono text-xs">Abc</span>
      );
    case 'number':
      return (
        <span className="text-emerald-400 font-mono text-xs">#</span>
      );
    case 'date':
      return (
        <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'boolean':
      return (
        <svg className="w-3.5 h-3.5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'geo':
      return (
        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
      );
    default:
      return <span className="w-3.5 h-3.5" />;
  }
}

function getFieldIcon(dataType: string): Field['icon'] {
  switch (dataType) {
    case 'i64':
    case 'i32':
    case 'i16':
    case 'f64':
      return 'number';
    case 'timestamp':
    case 'date':
    case 'time':
      return 'date';
    case 'b8':
      return 'boolean';
    case 'symbol':
    case 'c8':
    default:
      return 'text';
  }
}

function isNumericType(dataType: string): boolean {
  return ['i64', 'i32', 'i16', 'f64'].includes(dataType);
}

interface FieldItemProps {
  field: Field;
  onDragStart: (field: Field) => void;
  onDoubleClick: (field: Field) => void;
}

function FieldItem({ field, onDragStart, onDoubleClick }: FieldItemProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(field)}
      onDoubleClick={() => onDoubleClick(field)}
      className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded cursor-grab active:cursor-grabbing group"
    >
      <FieldIcon type={field.icon} />
      <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white truncate flex-1">
        {field.name}
      </span>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, count, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800/30 text-left"
      >
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-gray-400 dark:text-gray-500">{count}</span>
          <svg
            className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {isOpen && <div className="pb-2">{children}</div>}
    </div>
  );
}

export function DataPanel() {
  const { dataset, addColumnToRows, addColumnToValues } = useRayLensStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Convert schema to fields
  const fields = useMemo<Field[]>(() => {
    if (!dataset?.schema) return [];

    return dataset.schema.map((col) => ({
      name: col.name,
      type: isNumericType(col.type) ? 'measure' : 'dimension',
      dataType: col.type,
      icon: getFieldIcon(col.type),
    }));
  }, [dataset?.schema]);

  // Split into dimensions and measures
  const dimensions = useMemo(
    () => fields.filter((f) => f.type === 'dimension'),
    [fields]
  );

  const measures = useMemo(
    () => fields.filter((f) => f.type === 'measure'),
    [fields]
  );

  // Filter by search
  const filteredDimensions = useMemo(
    () => dimensions.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [dimensions, searchQuery]
  );

  const filteredMeasures = useMemo(
    () => measures.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [measures, searchQuery]
  );

  const handleDragStart = (field: Field) => {
    // Store field info for drop targets
    const event = window.event as DragEvent;
    event?.dataTransfer?.setData('application/json', JSON.stringify(field));
  };

  const handleDoubleClick = (field: Field) => {
    // Auto-add field based on type
    if (field.type === 'dimension') {
      addColumnToRows(field.name);
    } else {
      addColumnToValues(field.name, 'sum');
    }
  };

  if (!dataset) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Data</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-gray-500 text-center">
            No data loaded.<br />
            Load a dataset to start visualizing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-ray-600 dark:text-ray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{dataset.name}</h2>
        </div>
        <div className="text-2xs text-gray-500">
          {dataset.rowCount.toLocaleString()} rows
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded focus:border-ray-500 focus:outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto">
        <CollapsibleSection title="Dimensions" count={filteredDimensions.length}>
          <div className="px-1">
            {filteredDimensions.map((field) => (
              <FieldItem
                key={field.name}
                field={field}
                onDragStart={handleDragStart}
                onDoubleClick={handleDoubleClick}
              />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Measures" count={filteredMeasures.length}>
          <div className="px-1">
            {filteredMeasures.map((field) => (
              <FieldItem
                key={field.name}
                field={field}
                onDragStart={handleDragStart}
                onDoubleClick={handleDoubleClick}
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
