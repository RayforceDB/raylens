/**
 * PropertyInspector - Configuration panel for selected component
 * Right-side panel for configuring widget properties and encodings
 */

import { useState } from 'react';
import type { ComponentDefinition } from '../palette/ComponentPalette';
import type { EncodedField } from '../viz/EncodingShelf';

interface PropertyInspectorProps {
  selectedComponent: ComponentDefinition | null;
  title: string;
  onTitleChange: (title: string) => void;
  dataSource: string | null;
  onDataSourceChange: (source: string) => void;
  encodings: {
    x: EncodedField | undefined;
    y: EncodedField | undefined;
    color: EncodedField | undefined;
    size?: EncodedField;
  };
  onEncodingChange: (channel: string, field: EncodedField | null) => void;
  availableFields: string[];
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-800/30 text-left"
      >
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
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

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <label className="text-xs text-gray-400 w-20 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:border-ray-500 focus:outline-none text-gray-300"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:border-ray-500 focus:outline-none text-gray-300"
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

export function PropertyInspector({
  selectedComponent,
  title,
  onTitleChange,
  dataSource,
  onDataSourceChange,
  encodings,
  onEncodingChange,
  availableFields,
}: PropertyInspectorProps) {
  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Properties
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-gray-500 text-center">
            Select a component to view its properties
          </p>
        </div>
      </div>
    );
  }

  const fieldOptions = availableFields.map((f) => ({ value: f, label: f }));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-ray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Properties
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <div className="text-gray-500">{selectedComponent.icon}</div>
          <span className="text-sm text-gray-300">{selectedComponent.name}</span>
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto">
        {/* General */}
        <Section title="General">
          <PropertyRow label="Title">
            <TextInput
              value={title}
              onChange={onTitleChange}
              placeholder="Component title"
            />
          </PropertyRow>
        </Section>

        {/* Data Source */}
        <Section title="Data Source">
          <PropertyRow label="Source">
            <SelectInput
              value={dataSource ?? ''}
              onChange={onDataSourceChange}
              options={[
                { value: 'local', label: 'Local Dataset' },
                { value: 'remote', label: 'Remote Node' },
              ]}
              placeholder="Select source..."
            />
          </PropertyRow>
        </Section>

        {/* Encodings */}
        {selectedComponent.category === 'charts' && (
          <Section title="Encodings">
            <PropertyRow label="X Axis">
              <SelectInput
                value={encodings.x?.name ?? ''}
                onChange={(v) =>
                  onEncodingChange('x', v ? { name: v } : null)
                }
                options={fieldOptions}
                placeholder="Select field..."
              />
            </PropertyRow>
            <PropertyRow label="Y Axis">
              <SelectInput
                value={encodings.y?.name ?? ''}
                onChange={(v) =>
                  onEncodingChange('y', v ? { name: v } : null)
                }
                options={fieldOptions}
                placeholder="Select field..."
              />
            </PropertyRow>
            <PropertyRow label="Color">
              <SelectInput
                value={encodings.color?.name ?? ''}
                onChange={(v) =>
                  onEncodingChange('color', v ? { name: v } : null)
                }
                options={fieldOptions}
                placeholder="None"
              />
            </PropertyRow>
            <PropertyRow label="Size">
              <SelectInput
                value={encodings.size?.name ?? ''}
                onChange={(v) =>
                  onEncodingChange('size', v ? { name: v } : null)
                }
                options={fieldOptions}
                placeholder="None"
              />
            </PropertyRow>
          </Section>
        )}

        {/* Style */}
        <Section title="Style" defaultOpen={false}>
          <PropertyRow label="Background">
            <TextInput value="transparent" onChange={() => {}} />
          </PropertyRow>
          <PropertyRow label="Border">
            <SelectInput
              value="none"
              onChange={() => {}}
              options={[
                { value: 'none', label: 'None' },
                { value: 'solid', label: 'Solid' },
                { value: 'dashed', label: 'Dashed' },
              ]}
            />
          </PropertyRow>
        </Section>

        {/* Actions */}
        <Section title="Actions" defaultOpen={false}>
          <div className="text-xs text-gray-500 py-2">
            Configure click, hover, and selection actions
          </div>
          <button className="w-full px-3 py-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 rounded transition-colors">
            + Add Action
          </button>
        </Section>
      </div>
    </div>
  );
}
