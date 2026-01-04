/**
 * PropertyInspector - Configuration panel for selected dashboard component
 * 
 * Based on KX Dashboards property inspector with:
 * - Component info & general settings
 * - Data source configuration
 * - Column/field mappings for charts
 * - Style properties (colors, fonts, borders)
 * - Layout controls (size, position)
 * - Behavior settings (interactions, tooltips)
 * - Action configuration (click, select, hover events)
 * - Conditional formatting rules
 */

import { useState, useCallback } from 'react';
import type { ComponentDefinition } from '../palette/ComponentPalette';
import type { EncodedField } from '../viz/EncodingShelf';

// Types for property inspector
interface StyleConfig {
  background: string;
  borderStyle: 'none' | 'solid' | 'dashed' | 'dotted';
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow: 'none' | 'sm' | 'md' | 'lg';
  opacity: number;
}

interface LayoutConfig {
  padding: number;
  margin: number;
}

interface BehaviorConfig {
  showTooltip: boolean;
  tooltipTrigger: 'hover' | 'click';
  enableZoom: boolean;
  enablePan: boolean;
  enableSelection: boolean;
  selectionMode: 'single' | 'multiple';
  refreshInterval: number; // 0 = disabled
}

interface ActionConfig {
  id: string;
  trigger: 'click' | 'doubleClick' | 'select' | 'hover';
  actionType: 'navigate' | 'filter' | 'setVariable' | 'runQuery' | 'custom';
  config: Record<string, unknown>;
}

interface ConditionalRule {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'between';
  value: string;
  value2?: string; // For 'between'
  style: Partial<StyleConfig>;
  enabled: boolean;
}

interface PropertyInspectorProps {
  selectedComponent: ComponentDefinition | null;
  title: string;
  onTitleChange: (title: string) => void;
  subtitle?: string;
  onSubtitleChange?: (subtitle: string) => void;
  dataSource: string | null;
  onDataSourceChange: (source: string) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  encodings: {
    x?: EncodedField;
    y?: EncodedField;
    color?: EncodedField;
    size?: EncodedField;
    label?: EncodedField;
    detail?: EncodedField;
  };
  onEncodingChange: (channel: string, field: EncodedField | null) => void;
  availableFields: string[];
  availableTables?: string[];
  style?: StyleConfig;
  onStyleChange?: (style: Partial<StyleConfig>) => void;
  layout?: LayoutConfig;
  onLayoutChange?: (layout: Partial<LayoutConfig>) => void;
  behavior?: BehaviorConfig;
  onBehaviorChange?: (behavior: Partial<BehaviorConfig>) => void;
  actions?: ActionConfig[];
  onActionsChange?: (actions: ActionConfig[]) => void;
  conditionalRules?: ConditionalRule[];
  onConditionalRulesChange?: (rules: ConditionalRule[]) => void;
}

// Collapsible section component
function Section({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800/30 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {title}
          </span>
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 bg-ray-500/20 text-ray-600 dark:text-ray-400 text-2xs rounded-full">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// Property row component
function PropertyRow({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>
        {help && (
          <span className="text-gray-400 dark:text-gray-600 cursor-help" title={help}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

// Text input component
function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  min,
  max,
  step,
  disabled,
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:border-ray-500 focus:outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 disabled:opacity-50"
    />
  );
}

// Select input component
function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; group?: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  // Group options if any have group property
  const hasGroups = options.some(o => o.group);
  
  if (hasGroups) {
    const groups = Array.from(new Set(options.map(o => o.group).filter(Boolean)));
    const ungrouped = options.filter(o => !o.group);
    
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:border-ray-500 focus:outline-none text-gray-700 dark:text-gray-300 disabled:opacity-50"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {ungrouped.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {groups.map(group => (
          <optgroup key={group} label={group}>
            {options.filter(o => o.group === group).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:border-ray-500 focus:outline-none text-gray-700 dark:text-gray-300 disabled:opacity-50"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// Toggle switch component
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-ray-600' : 'bg-gray-300 dark:bg-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// Color picker component
function ColorPicker({
  value,
  onChange,
  presets,
}: {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
}) {
  const defaultPresets = [
    'transparent', '#ffffff', '#000000',
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#0ea5e9', '#6366f1', '#a855f7', '#ec4899',
  ];

  const colors = presets || defaultPresets;

  return (
    <div className="flex flex-wrap gap-1">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={`w-5 h-5 rounded border ${
            value === color
              ? 'ring-2 ring-ray-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
              : 'border-gray-300 dark:border-gray-700'
          } ${color === 'transparent' ? 'bg-checkered' : ''}`}
          style={{ backgroundColor: color === 'transparent' ? undefined : color }}
          title={color}
        />
      ))}
      <input
        type="color"
        value={value === 'transparent' ? '#ffffff' : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-5 h-5 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
      />
    </div>
  );
}

// Slider component
function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showValue = true,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="flex-1 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-ray-500"
      />
      {showValue && (
        <span className="text-2xs text-gray-500 w-8 text-right">{value}</span>
      )}
    </div>
  );
}

// Action item component
function ActionItem({
  action,
  onRemove,
  onUpdate,
}: {
  action: ActionConfig;
  onRemove: () => void;
  onUpdate: (config: Partial<ActionConfig>) => void;
}) {
  const triggerLabels = {
    click: 'On Click',
    doubleClick: 'On Double Click',
    select: 'On Select',
    hover: 'On Hover',
  };

  const actionLabels = {
    navigate: 'Navigate to URL',
    filter: 'Filter Data',
    setVariable: 'Set Variable',
    runQuery: 'Run Query',
    custom: 'Custom Code',
  };

  return (
    <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-medium text-gray-700 dark:text-gray-300">
          {triggerLabels[action.trigger]}
        </span>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-1.5">
        <SelectInput
          value={action.actionType}
          onChange={(v) => onUpdate({ actionType: v as ActionConfig['actionType'] })}
          options={Object.entries(actionLabels).map(([value, label]) => ({ value, label }))}
        />
        {action.actionType === 'navigate' && (
          <TextInput
            value={(action.config.url as string) || ''}
            onChange={(v) => onUpdate({ config: { ...action.config, url: v } })}
            placeholder="Enter URL..."
          />
        )}
        {action.actionType === 'setVariable' && (
          <>
            <TextInput
              value={(action.config.variable as string) || ''}
              onChange={(v) => onUpdate({ config: { ...action.config, variable: v } })}
              placeholder="Variable name..."
            />
            <TextInput
              value={(action.config.value as string) || ''}
              onChange={(v) => onUpdate({ config: { ...action.config, value: v } })}
              placeholder="Value expression..."
            />
          </>
        )}
        {action.actionType === 'runQuery' && (
          <textarea
            value={(action.config.query as string) || ''}
            onChange={(e) => onUpdate({ config: { ...action.config, query: e.target.value } })}
            placeholder="Rayfall query..."
            rows={2}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:border-ray-500 focus:outline-none text-gray-700 dark:text-gray-300 font-mono"
          />
        )}
      </div>
    </div>
  );
}

// Conditional rule item
function ConditionalRuleItem({
  rule,
  fields,
  onRemove,
  onUpdate,
}: {
  rule: ConditionalRule;
  fields: string[];
  onRemove: () => void;
  onUpdate: (updates: Partial<ConditionalRule>) => void;
}) {
  const operators = [
    { value: 'eq', label: '=' },
    { value: 'ne', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'contains', label: 'contains' },
    { value: 'between', label: 'between' },
  ];

  return (
    <div className={`px-2 py-1.5 rounded border mb-2 ${
      rule.enabled 
        ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        : 'bg-gray-50 dark:bg-gray-900 border-gray-200/50 dark:border-gray-800 opacity-60'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <Toggle checked={rule.enabled} onChange={(v) => onUpdate({ enabled: v })} />
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        <SelectInput
          value={rule.field}
          onChange={(v) => onUpdate({ field: v })}
          options={fields.map(f => ({ value: f, label: f }))}
          placeholder="Field"
        />
        <SelectInput
          value={rule.operator}
          onChange={(v) => onUpdate({ operator: v as ConditionalRule['operator'] })}
          options={operators}
        />
        <TextInput
          value={rule.value}
          onChange={(v) => onUpdate({ value: v })}
          placeholder="Value"
        />
      </div>
      {rule.operator === 'between' && (
        <div className="mb-2">
          <TextInput
            value={rule.value2 || ''}
            onChange={(v) => onUpdate({ value2: v })}
            placeholder="Second value"
          />
        </div>
      )}
      <div className="text-2xs text-gray-500 mb-1">Style when true:</div>
      <div className="flex items-center gap-2">
        <ColorPicker
          value={rule.style.background || 'transparent'}
          onChange={(v) => onUpdate({ style: { ...rule.style, background: v } })}
          presets={['transparent', '#fef2f2', '#fef9c3', '#dcfce7', '#dbeafe']}
        />
      </div>
    </div>
  );
}

export function PropertyInspector({
  selectedComponent,
  title,
  onTitleChange,
  subtitle,
  onSubtitleChange,
  dataSource,
  onDataSourceChange,
  query,
  onQueryChange,
  encodings,
  onEncodingChange,
  availableFields,
  availableTables = [],
  style,
  onStyleChange,
  layout,
  onLayoutChange,
  behavior,
  onBehaviorChange,
  actions = [],
  onActionsChange,
  conditionalRules = [],
  onConditionalRulesChange,
}: PropertyInspectorProps) {
  
  // Add action handler
  const addAction = useCallback(() => {
    const newAction: ActionConfig = {
      id: Date.now().toString(),
      trigger: 'click',
      actionType: 'navigate',
      config: {},
    };
    onActionsChange?.([...actions, newAction]);
  }, [actions, onActionsChange]);

  // Remove action handler
  const removeAction = useCallback((id: string) => {
    onActionsChange?.(actions.filter(a => a.id !== id));
  }, [actions, onActionsChange]);

  // Update action handler
  const updateAction = useCallback((id: string, updates: Partial<ActionConfig>) => {
    onActionsChange?.(actions.map(a => a.id === id ? { ...a, ...updates } : a));
  }, [actions, onActionsChange]);

  // Add conditional rule handler
  const addConditionalRule = useCallback(() => {
    const newRule: ConditionalRule = {
      id: Date.now().toString(),
      field: availableFields[0] || '',
      operator: 'gt',
      value: '',
      style: { background: '#fef2f2' },
      enabled: true,
    };
    onConditionalRulesChange?.([...conditionalRules, newRule]);
  }, [conditionalRules, availableFields, onConditionalRulesChange]);

  // Remove conditional rule handler
  const removeConditionalRule = useCallback((id: string) => {
    onConditionalRulesChange?.(conditionalRules.filter(r => r.id !== id));
  }, [conditionalRules, onConditionalRulesChange]);

  // Update conditional rule handler
  const updateConditionalRule = useCallback((id: string, updates: Partial<ConditionalRule>) => {
    onConditionalRulesChange?.(conditionalRules.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [conditionalRules, onConditionalRulesChange]);

  // Empty state
  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Properties
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 mb-1">No Component Selected</p>
            <p className="text-2xs text-gray-400">
              Click on a component to configure its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fieldOptions = [
    { value: '', label: 'None' },
    ...availableFields.map((f) => ({ value: f, label: f })),
  ];

  const tableOptions = [
    { value: 'local', label: 'Current Dataset' },
    ...availableTables.map((t) => ({ value: t, label: t })),
  ];

  const isChart = selectedComponent.category === 'charts';
  const isTable = selectedComponent.id === 'data-grid';
  const isControl = selectedComponent.category === 'controls';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-ray-600 dark:text-ray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Properties
        </h2>
        <div className="flex items-center gap-2 mt-2 px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded">
          <span className="text-ray-500">{selectedComponent.icon}</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{selectedComponent.name}</span>
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto">
        {/* General */}
        <Section title="General">
          <PropertyRow label="Title" help="Display title for this component">
            <TextInput
              value={title}
              onChange={onTitleChange}
              placeholder="Component title"
            />
          </PropertyRow>
          {onSubtitleChange && (
            <PropertyRow label="Subtitle">
              <TextInput
                value={subtitle || ''}
                onChange={onSubtitleChange}
                placeholder="Optional subtitle"
              />
            </PropertyRow>
          )}
        </Section>

        {/* Data Source */}
        <Section title="Data Source">
          <PropertyRow label="Table" help="Select the data source for this component">
            <SelectInput
              value={dataSource || ''}
              onChange={onDataSourceChange}
              options={tableOptions}
              placeholder="Select table..."
            />
          </PropertyRow>
          {onQueryChange && (
            <PropertyRow label="Query" help="Custom Rayfall query to filter/transform data">
              <textarea
                value={query || ''}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="(select {from: table where: ...})"
                rows={3}
                className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:border-ray-500 focus:outline-none text-gray-700 dark:text-gray-300 font-mono placeholder-gray-400 dark:placeholder-gray-600"
              />
            </PropertyRow>
          )}
        </Section>

        {/* Encodings (Charts) */}
        {isChart && (
          <Section title="Encodings" badge={Object.values(encodings).filter(Boolean).length}>
            <PropertyRow label="X Axis" help="Field for horizontal axis">
              <SelectInput
                value={encodings.x?.name || ''}
                onChange={(v) => onEncodingChange('x', v ? { name: v } : null)}
                options={fieldOptions}
                placeholder="Select field..."
              />
            </PropertyRow>
            <PropertyRow label="Y Axis" help="Field for vertical axis">
              <SelectInput
                value={encodings.y?.name || ''}
                onChange={(v) => onEncodingChange('y', v ? { name: v } : null)}
                options={fieldOptions}
                placeholder="Select field..."
              />
            </PropertyRow>
            <PropertyRow label="Color" help="Field for color encoding">
              <SelectInput
                value={encodings.color?.name || ''}
                onChange={(v) => onEncodingChange('color', v ? { name: v } : null)}
                options={fieldOptions}
              />
            </PropertyRow>
            <PropertyRow label="Size" help="Field for size encoding">
              <SelectInput
                value={encodings.size?.name || ''}
                onChange={(v) => onEncodingChange('size', v ? { name: v } : null)}
                options={fieldOptions}
              />
            </PropertyRow>
            <PropertyRow label="Label" help="Field for data labels">
              <SelectInput
                value={encodings.label?.name || ''}
                onChange={(v) => onEncodingChange('label', v ? { name: v } : null)}
                options={fieldOptions}
              />
            </PropertyRow>
          </Section>
        )}

        {/* Column Config (Tables) */}
        {isTable && (
          <Section title="Columns">
            <div className="text-2xs text-gray-500 mb-2">
              Visible columns from your data source
            </div>
            {availableFields.length > 0 ? (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {availableFields.map((field) => (
                  <label key={field} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-gray-300 text-ray-500 focus:ring-ray-500"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{field}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-2xs text-gray-400 italic">No fields available</div>
            )}
          </Section>
        )}

        {/* Control Config */}
        {isControl && (
          <Section title="Control Settings">
            <PropertyRow label="Bound Field" help="Field this control filters/modifies">
              <SelectInput
                value=""
                onChange={() => {}}
                options={fieldOptions}
                placeholder="Select field..."
              />
            </PropertyRow>
            <PropertyRow label="Default Value">
              <TextInput
                value=""
                onChange={() => {}}
                placeholder="Default value..."
              />
            </PropertyRow>
          </Section>
        )}

        {/* Style */}
        {onStyleChange && style && (
          <Section title="Style" defaultOpen={false}>
            <PropertyRow label="Background">
              <ColorPicker
                value={style.background}
                onChange={(v) => onStyleChange({ background: v })}
              />
            </PropertyRow>
            <PropertyRow label="Border Style">
              <SelectInput
                value={style.borderStyle}
                onChange={(v) => onStyleChange({ borderStyle: v as StyleConfig['borderStyle'] })}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'solid', label: 'Solid' },
                  { value: 'dashed', label: 'Dashed' },
                  { value: 'dotted', label: 'Dotted' },
                ]}
              />
            </PropertyRow>
            {style.borderStyle !== 'none' && (
              <>
                <PropertyRow label="Border Color">
                  <ColorPicker
                    value={style.borderColor}
                    onChange={(v) => onStyleChange({ borderColor: v })}
                  />
                </PropertyRow>
                <PropertyRow label="Border Width">
                  <Slider
                    value={style.borderWidth}
                    onChange={(v) => onStyleChange({ borderWidth: v })}
                    min={1}
                    max={10}
                  />
                </PropertyRow>
              </>
            )}
            <PropertyRow label="Border Radius">
              <Slider
                value={style.borderRadius}
                onChange={(v) => onStyleChange({ borderRadius: v })}
                min={0}
                max={24}
              />
            </PropertyRow>
            <PropertyRow label="Shadow">
              <SelectInput
                value={style.shadow}
                onChange={(v) => onStyleChange({ shadow: v as StyleConfig['shadow'] })}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'sm', label: 'Small' },
                  { value: 'md', label: 'Medium' },
                  { value: 'lg', label: 'Large' },
                ]}
              />
            </PropertyRow>
            <PropertyRow label="Opacity">
              <Slider
                value={style.opacity * 100}
                onChange={(v) => onStyleChange({ opacity: v / 100 })}
                min={10}
                max={100}
              />
            </PropertyRow>
          </Section>
        )}

        {/* Layout */}
        {onLayoutChange && layout && (
          <Section title="Layout" defaultOpen={false}>
            <PropertyRow label="Padding">
              <Slider
                value={layout.padding}
                onChange={(v) => onLayoutChange({ padding: v })}
                min={0}
                max={32}
              />
            </PropertyRow>
            <PropertyRow label="Margin">
              <Slider
                value={layout.margin}
                onChange={(v) => onLayoutChange({ margin: v })}
                min={0}
                max={32}
              />
            </PropertyRow>
          </Section>
        )}

        {/* Behavior */}
        {onBehaviorChange && behavior && (
          <Section title="Behavior" defaultOpen={false}>
            <PropertyRow label="Show Tooltip">
              <Toggle
                checked={behavior.showTooltip}
                onChange={(v) => onBehaviorChange({ showTooltip: v })}
              />
            </PropertyRow>
            {behavior.showTooltip && (
              <PropertyRow label="Tooltip Trigger">
                <SelectInput
                  value={behavior.tooltipTrigger}
                  onChange={(v) => onBehaviorChange({ tooltipTrigger: v as 'hover' | 'click' })}
                  options={[
                    { value: 'hover', label: 'On Hover' },
                    { value: 'click', label: 'On Click' },
                  ]}
                />
              </PropertyRow>
            )}
            {isChart && (
              <>
                <PropertyRow label="Enable Zoom">
                  <Toggle
                    checked={behavior.enableZoom}
                    onChange={(v) => onBehaviorChange({ enableZoom: v })}
                  />
                </PropertyRow>
                <PropertyRow label="Enable Pan">
                  <Toggle
                    checked={behavior.enablePan}
                    onChange={(v) => onBehaviorChange({ enablePan: v })}
                  />
                </PropertyRow>
              </>
            )}
            <PropertyRow label="Selection">
              <Toggle
                checked={behavior.enableSelection}
                onChange={(v) => onBehaviorChange({ enableSelection: v })}
              />
            </PropertyRow>
            {behavior.enableSelection && (
              <PropertyRow label="Selection Mode">
                <SelectInput
                  value={behavior.selectionMode}
                  onChange={(v) => onBehaviorChange({ selectionMode: v as 'single' | 'multiple' })}
                  options={[
                    { value: 'single', label: 'Single' },
                    { value: 'multiple', label: 'Multiple' },
                  ]}
                />
              </PropertyRow>
            )}
            <PropertyRow label="Auto Refresh" help="Refresh interval in seconds (0 = disabled)">
              <div className="flex items-center gap-2">
                <TextInput
                  type="number"
                  value={behavior.refreshInterval}
                  onChange={(v) => onBehaviorChange({ refreshInterval: parseInt(v) || 0 })}
                  min={0}
                  step={1}
                />
                <span className="text-2xs text-gray-500">sec</span>
              </div>
            </PropertyRow>
          </Section>
        )}

        {/* Actions */}
        {onActionsChange && (
          <Section title="Actions" badge={actions.length} defaultOpen={false}>
            <div className="text-2xs text-gray-500 mb-2">
              Configure interactions and events
            </div>
            {actions.map((action) => (
              <ActionItem
                key={action.id}
                action={action}
                onRemove={() => removeAction(action.id)}
                onUpdate={(updates) => updateAction(action.id, updates)}
              />
            ))}
            <button
              onClick={addAction}
              className="w-full px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Action
            </button>
          </Section>
        )}

        {/* Conditional Formatting */}
        {onConditionalRulesChange && (isTable || isChart) && (
          <Section title="Conditional Formatting" badge={conditionalRules.filter(r => r.enabled).length} defaultOpen={false}>
            <div className="text-2xs text-gray-500 mb-2">
              Apply styles based on data values
            </div>
            {conditionalRules.map((rule) => (
              <ConditionalRuleItem
                key={rule.id}
                rule={rule}
                fields={availableFields}
                onRemove={() => removeConditionalRule(rule.id)}
                onUpdate={(updates) => updateConditionalRule(rule.id, updates)}
              />
            ))}
            <button
              onClick={addConditionalRule}
              className="w-full px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Rule
            </button>
          </Section>
        )}

        {/* Export (Tables) */}
        {isTable && (
          <Section title="Export" defaultOpen={false}>
            <div className="space-y-2">
              <button className="w-full px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-left flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as CSV
              </button>
              <button className="w-full px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-left flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as Excel
              </button>
              <button className="w-full px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-left flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Copy to Clipboard
              </button>
            </div>
          </Section>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
        <div className="flex items-center justify-between text-2xs text-gray-500">
          <span>{selectedComponent.category}</span>
          <span>{selectedComponent.id}</span>
        </div>
      </div>
    </div>
  );
}
