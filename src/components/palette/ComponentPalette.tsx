/**
 * ComponentPalette - Draggable component library
 * Left panel with available dashboard widgets
 */

import { useState } from 'react';

export interface ComponentDefinition {
  id: string;
  name: string;
  category: 'charts' | 'tables' | 'controls' | 'layout';
  icon?: React.ReactNode; // Optional - not serializable for drag/drop
  description: string;
}

// Helper to get component by ID (for looking up icons after drag/drop)
export function getComponentById(id: string): ComponentDefinition | undefined {
  return COMPONENTS.find((c) => c.id === id);
}

const COMPONENTS: ComponentDefinition[] = [
  // Charts
  {
    id: 'bar-chart',
    name: 'Bar Chart',
    category: 'charts',
    description: 'Horizontal or vertical bar chart',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <rect x="4" y="10" width="4" height="10" rx="1" />
        <rect x="10" y="6" width="4" height="14" rx="1" />
        <rect x="16" y="2" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    id: 'line-chart',
    name: 'Line Chart',
    category: 'charts',
    description: 'Time series line chart',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 18l4-4 4 4 8-12" />
      </svg>
    ),
  },
  {
    id: 'area-chart',
    name: 'Area Chart',
    category: 'charts',
    description: 'Filled area chart',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24">
        <path fill="currentColor" opacity="0.5" d="M4 18l4-4 4 4 8-12v14H4v-2z" />
        <path fill="none" stroke="currentColor" strokeWidth={2} d="M4 18l4-4 4 4 8-12" />
      </svg>
    ),
  },
  {
    id: 'scatter-chart',
    name: 'Scatter Plot',
    category: 'charts',
    description: 'XY scatter plot',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="6" cy="14" r="2" />
        <circle cx="10" cy="8" r="2" />
        <circle cx="14" cy="16" r="2" />
        <circle cx="18" cy="6" r="2" />
      </svg>
    ),
  },
  {
    id: 'pie-chart',
    name: 'Pie Chart',
    category: 'charts',
    description: 'Circular statistical graphic',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8v8l5.66 5.66C14.32 18.79 13.22 20 12 20z" />
      </svg>
    ),
  },
  {
    id: 'heatmap',
    name: 'Heatmap',
    category: 'charts',
    description: 'Color-coded matrix chart',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
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
    ),
  },
  {
    id: 'candlestick',
    name: 'Candlestick',
    category: 'charts',
    description: 'Financial OHLC chart',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <rect x="5" y="8" width="2" height="8" />
        <line x1="6" y1="4" x2="6" y2="8" stroke="currentColor" strokeWidth="1" />
        <line x1="6" y1="16" x2="6" y2="20" stroke="currentColor" strokeWidth="1" />
        <rect x="11" y="6" width="2" height="10" />
        <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="12" y1="16" x2="12" y2="22" stroke="currentColor" strokeWidth="1" />
        <rect x="17" y="10" width="2" height="6" />
        <line x1="18" y1="6" x2="18" y2="10" stroke="currentColor" strokeWidth="1" />
        <line x1="18" y1="16" x2="18" y2="18" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    id: 'treemap',
    name: 'Treemap',
    category: 'charts',
    description: 'Hierarchical treemap',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <rect x="2" y="2" width="10" height="12" opacity="0.7" rx="1" />
        <rect x="14" y="2" width="8" height="6" opacity="0.5" rx="1" />
        <rect x="14" y="10" width="8" height="4" opacity="0.6" rx="1" />
        <rect x="2" y="16" width="6" height="6" opacity="0.4" rx="1" />
        <rect x="10" y="16" width="12" height="6" opacity="0.8" rx="1" />
      </svg>
    ),
  },
  // Tables
  {
    id: 'data-grid',
    name: 'Data Grid',
    category: 'tables',
    description: 'Interactive data table',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M3 6h18M3 18h18M7 6v12M12 6v12M17 6v12" />
      </svg>
    ),
  },
  {
    id: 'pivot-grid',
    name: 'Pivot Grid',
    category: 'tables',
    description: 'OLAP drilldown display',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 3v18" />
        <path d="M9 9l6 6M9 15l6-6" strokeLinecap="round" />
      </svg>
    ),
  },
  // Controls
  {
    id: 'filter',
    name: 'Data Filter',
    category: 'controls',
    description: 'Interactive data filter',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
  },
  {
    id: 'date-picker',
    name: 'Date Range',
    category: 'controls',
    description: 'Date range selector',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'dropdown',
    name: 'Dropdown',
    category: 'controls',
    description: 'Selection dropdown',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    ),
  },
  {
    id: 'text-input',
    name: 'Text Input',
    category: 'controls',
    description: 'Text input field',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  // Layout
  {
    id: 'flex-panel',
    name: 'Flex Panel',
    category: 'layout',
    description: 'Flexible container',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="18" rx="1" />
      </svg>
    ),
  },
  {
    id: 'tab-control',
    name: 'Tab Control',
    category: 'layout',
    description: 'Tabbed container',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M3 7h6V4a1 1 0 011-1h4a1 1 0 011 1v3" />
      </svg>
    ),
  },
];

interface ComponentPaletteProps {
  onDragStart: (component: ComponentDefinition) => void;
  onComponentClick: (component: ComponentDefinition) => void;
}

function CategorySection({
  title,
  components,
  onDragStart,
  onComponentClick,
}: {
  title: string;
  components: ComponentDefinition[];
  onDragStart: (component: ComponentDefinition) => void;
  onComponentClick: (component: ComponentDefinition) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800/30 text-left"
      >
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="grid grid-cols-2 gap-1 p-2">
          {components.map((component) => (
            <div
              key={component.id}
              draggable
              onDragStart={(e) => {
                // Don't include icon in JSON - React elements can't be serialized
                const { icon, ...serializableComponent } = component;
                e.dataTransfer.setData('component', JSON.stringify(serializableComponent));
                onDragStart(component);
              }}
              onClick={() => onComponentClick(component)}
              className="flex flex-col items-center gap-1 p-2 rounded cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
              title={component.description}
            >
              <div className="text-gray-400 dark:text-gray-500 group-hover:text-ray-500 dark:group-hover:text-ray-400 transition-colors">
                {component.icon}
              </div>
              <span className="text-2xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 text-center leading-tight">
                {component.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ComponentPalette({ onDragStart, onComponentClick }: ComponentPaletteProps) {
  const charts = COMPONENTS.filter((c) => c.category === 'charts');
  const tables = COMPONENTS.filter((c) => c.category === 'tables');
  const controls = COMPONENTS.filter((c) => c.category === 'controls');
  const layout = COMPONENTS.filter((c) => c.category === 'layout');

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-ray-600 dark:text-ray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          Components
        </h2>
        <p className="text-2xs text-gray-500 mt-1">
          Drag to canvas or click to add
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <CategorySection
          title="Charts"
          components={charts}
          onDragStart={onDragStart}
          onComponentClick={onComponentClick}
        />
        <CategorySection
          title="Tables"
          components={tables}
          onDragStart={onDragStart}
          onComponentClick={onComponentClick}
        />
        <CategorySection
          title="Controls"
          components={controls}
          onDragStart={onDragStart}
          onComponentClick={onComponentClick}
        />
        <CategorySection
          title="Layout"
          components={layout}
          onDragStart={onDragStart}
          onComponentClick={onComponentClick}
        />
      </div>
    </div>
  );
}
