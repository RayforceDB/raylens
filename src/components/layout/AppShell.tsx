/**
 * AppShell - Main application layout
 * Dashboard-style interface with palette, canvas, and inspector
 * 
 * Layout:
 * - Left: Component palette + Data panel (collapsible)
 * - Center: Dashboard canvas with draggable widgets
 * - Right: Property inspector (collapsible)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRayLensStore } from '@core/store';
import { DataPanel } from '../data/DataPanel';
import { ComponentPalette, type ComponentDefinition } from '../palette/ComponentPalette';
import { PropertyInspector } from '../inspector/PropertyInspector';
import { DashboardCanvas, type DashboardWidget } from '../canvas/DashboardCanvas';

type LeftPanelTab = 'components' | 'data';

export function AppShell() {
  const {
    version,
    dataset,
    loadSampleData,
    loadCSVData,
  } = useRayLensStore();

  // Panel visibility
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('components');

  // Dashboard state
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<DashboardWidget | null>(null);

  // Canvas width for grid layout
  const [canvasWidth, setCanvasWidth] = useState(800);
  const canvasRef = useRef<HTMLDivElement>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Measure canvas width
  useEffect(() => {
    const updateWidth = () => {
      if (canvasRef.current) {
        setCanvasWidth(canvasRef.current.offsetWidth - 32); // Padding
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [leftPanelOpen, rightPanelOpen]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await loadCSVData(file);
        setLeftPanelTab('data');
      }
    },
    [loadCSVData]
  );

  // Component palette handlers
  const handleComponentDragStart = useCallback((_component: ComponentDefinition) => {
    // Could show drop indicator
  }, []);

  const handleComponentClick = useCallback((component: ComponentDefinition) => {
    // Add component to canvas at default position
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
    setWidgets((prev) => [...prev, newWidget]);
    setSelectedWidget(newWidget);
  }, []);

  // Property inspector handlers
  const handleTitleChange = useCallback((title: string) => {
    if (!selectedWidget) return;
    setWidgets((prev) =>
      prev.map((w) => (w.id === selectedWidget.id ? { ...w, title } : w))
    );
    setSelectedWidget((prev) => (prev ? { ...prev, title } : null));
  }, [selectedWidget]);

  const handleEncodingChange = useCallback((channel: string, field: { name: string } | null) => {
    if (!selectedWidget) return;
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id !== selectedWidget.id) return w;
        
        const newEncodings = { ...w.encodings };
        if (channel === 'x') {
          newEncodings.rows = field ? [{ name: field.name }] : [];
        } else if (channel === 'y') {
          newEncodings.columns = field ? [{ name: field.name }] : [];
        } else if (channel === 'color') {
          newEncodings.color = field ? { name: field.name } : undefined;
        }
        
        return { ...w, encodings: newEncodings };
      })
    );
  }, [selectedWidget]);

  // Get available fields from dataset
  const availableFields = dataset?.schema.map((s) => s.name) ?? [];

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Top toolbar */}
      <header className="flex h-12 items-center justify-between border-b border-gray-800 px-4 shrink-0">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <svg
              className="h-6 w-6 text-ray-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="font-semibold text-white">RayLens</span>
          </div>

          {/* Menu items */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => {
                loadSampleData();
                setLeftPanelTab('data');
              }}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Sample Data
            </button>
            <div className="w-px h-6 bg-gray-800 mx-2" />
            <button
              onClick={() => setWidgets([])}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Dashboard
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">Rayforce {version ?? '...'}</span>
          {/* Panel toggles */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              className={`p-1.5 rounded transition-colors ${
                leftPanelOpen ? 'bg-gray-800 text-ray-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Toggle left panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className={`p-1.5 rounded transition-colors ${
                rightPanelOpen ? 'bg-gray-800 text-ray-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Toggle right panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Components & Data */}
        {leftPanelOpen && (
          <aside className="w-64 border-r border-gray-800 bg-gray-900/50 flex flex-col shrink-0">
            {/* Tab buttons */}
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setLeftPanelTab('components')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  leftPanelTab === 'components'
                    ? 'text-white bg-gray-800/50 border-b-2 border-ray-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Components
              </button>
              <button
                onClick={() => setLeftPanelTab('data')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  leftPanelTab === 'data'
                    ? 'text-white bg-gray-800/50 border-b-2 border-ray-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Data {dataset && <span className="ml-1 text-ray-400">•</span>}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {leftPanelTab === 'components' ? (
                <ComponentPalette
                  onDragStart={handleComponentDragStart}
                  onComponentClick={handleComponentClick}
                />
              ) : (
                <DataPanel />
              )}
            </div>
          </aside>
        )}

        {/* Center - Dashboard Canvas */}
        <main ref={canvasRef} className="flex-1 overflow-hidden p-4">
          <DashboardCanvas
            widgets={widgets}
            onWidgetsChange={setWidgets}
            onWidgetSelect={(w) => {
              setSelectedWidget(w);
              if (w) setRightPanelOpen(true);
            }}
            selectedWidgetId={selectedWidget?.id ?? null}
            width={canvasWidth}
          />
        </main>

        {/* Right panel - Property Inspector */}
        {rightPanelOpen && (
          <aside className="w-72 border-l border-gray-800 bg-gray-900/50 shrink-0">
            <PropertyInspector
              selectedComponent={selectedWidget?.component ?? null}
              title={selectedWidget?.title ?? ''}
              onTitleChange={handleTitleChange}
              dataSource={dataset ? 'local' : null}
              onDataSourceChange={() => {}}
              encodings={{
                x: selectedWidget?.encodings.rows[0],
                y: selectedWidget?.encodings.columns[0],
                color: selectedWidget?.encodings.color,
              }}
              onEncodingChange={handleEncodingChange}
              availableFields={availableFields}
            />
          </aside>
        )}
      </div>

      {/* Status bar */}
      <footer className="flex h-6 items-center justify-between border-t border-gray-800 bg-gray-900 px-4 text-2xs text-gray-500 shrink-0">
        <div className="flex items-center gap-4">
          {dataset ? (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {dataset.name}
              </span>
              <span>{dataset.rowCount.toLocaleString()} rows</span>
              <span>{dataset.schema.length} columns</span>
            </>
          ) : (
            <span>No data source connected</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</span>
        </div>
      </footer>
    </div>
  );
}
