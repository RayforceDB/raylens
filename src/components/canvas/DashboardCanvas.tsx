/**
 * DashboardCanvas - Draggable, resizable widget canvas
 * Central canvas for arranging dashboard components
 */

import { useState, useCallback } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import { ChartCanvas } from '../viz/ChartCanvas';
import { DataGrid } from '../tables/DataGrid';
import { FilterControl, DateRangePicker, DropdownControl, TextInput } from '../controls';
import { type ComponentDefinition, getComponentById } from '../palette/ComponentPalette';
import type { EncodedField } from '../viz/EncodingShelf';

export interface DashboardWidget {
  id: string;
  component: ComponentDefinition;
  layout: Layout;
  title: string;
  encodings: {
    rows: EncodedField[];
    columns: EncodedField[];
    color: EncodedField | undefined;
  };
}

interface DashboardCanvasProps {
  widgets: DashboardWidget[];
  onWidgetsChange: (widgets: DashboardWidget[]) => void;
  onWidgetSelect: (widget: DashboardWidget | null) => void;
  selectedWidgetId: string | null;
  width: number;
}

function WidgetContainer({
  widget,
  isSelected,
  onSelect,
  onRemove,
}: {
  widget: DashboardWidget;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const getChartType = () => {
    const id = widget.component.id;
    if (id === 'bar-chart') return 'bar';
    if (id === 'line-chart') return 'line';
    if (id === 'area-chart') return 'area';
    if (id === 'scatter-chart') return 'scatter';
    if (id === 'pie-chart') return 'pie';
    if (id === 'heatmap') return 'heatmap';
    return 'bar';
  };

  const renderContent = () => {
    const id = widget.component.id;
    
    // Charts
    if (widget.component.category === 'charts') {
      return (
        <ChartCanvas
          chartType={getChartType()}
          rows={widget.encodings.rows}
          columns={widget.encodings.columns}
          values={widget.encodings.columns}
          colorField={widget.encodings.color}
        />
      );
    }
    
    // Tables
    if (id === 'data-grid' || id === 'pivot-grid') {
      return <DataGrid />;
    }
    
    // Controls
    if (id === 'filter') {
      return <FilterControl />;
    }
    
    if (id === 'date-picker') {
      return <DateRangePicker />;
    }
    
    if (id === 'dropdown') {
      return <DropdownControl multiple />;
    }
    
    if (id === 'text-input') {
      return <TextInput mode="expression" />;
    }
    
    // Layout and other components - show placeholder
    return <ControlPlaceholder component={widget.component} />;
  };

  return (
    <div
      className={`h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg border shadow-sm dark:shadow-none transition-colors ${
        isSelected ? 'border-ray-500' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Widget header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 cursor-move drag-handle">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {widget.title || widget.component.name}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Widget content */}
      <div className="flex-1 p-2 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

function ControlPlaceholder({ component }: { component: ComponentDefinition }) {
  // Look up the full component definition (with icon) from registry
  const fullComponent = getComponentById(component.id);
  
  return (
    <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800/30 rounded">
      <div className="text-center">
        <div className="text-gray-400 dark:text-gray-600 mb-2">{fullComponent?.icon ?? '📦'}</div>
        <span className="text-xs text-gray-500">{component.name}</span>
      </div>
    </div>
  );
}

export function DashboardCanvas({
  widgets,
  onWidgetsChange,
  onWidgetSelect,
  selectedWidgetId,
  width,
}: DashboardCanvasProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      const updatedWidgets = widgets.map((widget) => {
        const layoutItem = newLayout.find((l) => l.i === widget.id);
        if (layoutItem) {
          return { ...widget, layout: layoutItem };
        }
        return widget;
      });
      onWidgetsChange(updatedWidgets);
    },
    [widgets, onWidgetsChange]
  );

  const handleRemoveWidget = useCallback(
    (id: string) => {
      onWidgetsChange(widgets.filter((w) => w.id !== id));
      if (selectedWidgetId === id) {
        onWidgetSelect(null);
      }
    },
    [widgets, onWidgetsChange, selectedWidgetId, onWidgetSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const componentData = e.dataTransfer.getData('component');
      if (!componentData) return;

      try {
        const component = JSON.parse(componentData) as ComponentDefinition;
        const widgetId = `widget-${Date.now()}`;
        const newWidget: DashboardWidget = {
          id: widgetId,
          component,
          layout: {
            i: widgetId, // Must match widget.id!
            x: 0,
            y: Infinity,
            w: 6,
            h: 4,
          },
          title: component.name,
          encodings: {
            rows: [],
            columns: [],
            color: undefined,
          },
        };
        onWidgetsChange([...widgets, newWidget]);
        onWidgetSelect(newWidget);
      } catch (err) {
        console.error('Invalid drop data:', err);
      }
    },
    [widgets, onWidgetsChange, onWidgetSelect]
  );

  const layout = widgets.map((w) => ({
    ...w.layout,
    i: w.id,
  }));

  // Empty state
  if (widgets.length === 0) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`h-full flex items-center justify-center border-2 border-dashed rounded-lg transition-colors ${
          isDragOver ? 'border-ray-500 bg-ray-500/5' : 'border-gray-300 dark:border-gray-800'
        }`}
      >
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Build Your Dashboard
          </h3>
          <p className="text-sm text-gray-500">
            Drag components from the palette on the left, or click to add them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`h-full overflow-auto ${isDragOver ? 'bg-ray-500/5' : ''}`}
    >
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={60}
        width={width > 0 ? width : 800}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        compactType="vertical"
        preventCollision={false}
        margin={[12, 12]}
      >
        {widgets.map((widget) => (
          <div key={widget.id}>
            <WidgetContainer
              widget={widget}
              isSelected={selectedWidgetId === widget.id}
              onSelect={() => onWidgetSelect(widget)}
              onRemove={() => handleRemoveWidget(widget.id)}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
