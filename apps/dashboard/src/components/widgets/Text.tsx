import React from 'react';
import type { RayforceResult } from '../../lib/rayforce';

interface TextWidgetProps {
  data: RayforceResult | unknown;
  config: Record<string, unknown>;
}

function formatNumber(value: unknown): string {
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    }
    if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toFixed(2);
  }
  return String(value ?? '');
}

export function TextWidget({ data, config }: TextWidgetProps) {
  let displayValue: string = '';
  let subtitle: string = '';
  let isError = false;
  
  // Handle null/undefined
  if (data === null || data === undefined) {
    return (
      <div className="widget-placeholder">
        No data - bind a query
      </div>
    );
  }
  
  // Check if it's a RayforceResult
  if (typeof data === 'object' && data !== null && 'type' in data) {
    const result = data as RayforceResult;
    
    // Handle error
    if (result.type === 'error') {
      return (
        <div className="widget-error">
          Error: {String(result.data)}
        </div>
      );
    }
    
    // Handle scalar - this is the primary case for count queries etc.
    if (result.type === 'scalar') {
      let val = result.data;
      if (val === undefined && result.toJS) {
        try {
          val = result.toJS();
        } catch {
          val = null;
        }
      }
      displayValue = formatNumber(val);
      // Don't add "rows" subtitle for scalar count results
      return renderKPI(displayValue, '', config);
    }
    
    // Handle null
    if (result.type === 'null') {
      displayValue = 'null';
      return renderKPI(displayValue, subtitle, config);
    }
    
    // Handle table/vector - get the data
    let jsData: unknown = null;
    if (result.toJS) {
      try {
        jsData = result.toJS();
      } catch (e) {
        console.error('[Text] toJS failed:', e);
        displayValue = 'Error';
        isError = true;
      }
    } else if (result.data !== undefined) {
      jsData = result.data;
    }
    
    // Extract value from JS data
    if (jsData !== null && !isError) {
      if (Array.isArray(jsData)) {
        if (jsData.length === 0) {
          displayValue = '0';
          subtitle = 'rows';
        } else if (jsData.length === 1) {
          const item = jsData[0];
          if (typeof item === 'object' && item !== null) {
            const keys = Object.keys(item);
            if (keys.length === 1) {
              displayValue = formatNumber((item as Record<string, unknown>)[keys[0]]);
              subtitle = keys[0];
            } else {
              displayValue = '1';
              subtitle = 'row';
            }
          } else {
            displayValue = formatNumber(item);
          }
        } else {
          displayValue = String(jsData.length);
          subtitle = 'rows';
        }
      } else if (typeof jsData === 'object') {
        const dict = jsData as Record<string, unknown>;
        const keys = Object.keys(dict);
        if (keys.length === 1) {
          const val = dict[keys[0]];
          if (Array.isArray(val) && val.length === 1) {
            displayValue = formatNumber(val[0]);
            subtitle = keys[0];
          } else if (Array.isArray(val)) {
            displayValue = String(val.length);
            subtitle = keys[0];
          } else {
            displayValue = formatNumber(val);
            subtitle = keys[0];
          }
        } else {
          displayValue = String(keys.length);
          subtitle = 'fields';
        }
      } else {
        displayValue = formatNumber(jsData);
      }
    }
    
    // Use rowCount if available
    if (!displayValue && result.rowCount !== undefined) {
      displayValue = formatNumber(result.rowCount);
      subtitle = 'rows';
    }
    
    return renderKPI(displayValue, subtitle, config, isError);
  }
  
  // Handle raw values (non-RayforceResult)
  if (typeof data === 'number') {
    displayValue = formatNumber(data);
  } else if (typeof data === 'string') {
    displayValue = data;
  } else if (Array.isArray(data)) {
    if (data.length === 1) {
      displayValue = formatNumber(data[0]);
    } else {
      displayValue = `${data.length}`;
      subtitle = 'items';
    }
  } else if (typeof data === 'object') {
    const keys = Object.keys(data as object);
    if (keys.length === 1) {
      const val = (data as Record<string, unknown>)[keys[0]];
      displayValue = formatNumber(Array.isArray(val) ? val[0] : val);
      subtitle = keys[0];
    } else {
      displayValue = `${keys.length}`;
      subtitle = 'fields';
    }
  }
  
  return renderKPI(displayValue, subtitle, config, isError);
}

function renderKPI(displayValue: string, subtitle: string, config: Record<string, unknown>, isError = false) {
  const fontSize = config.fontSize as number || 48;
  const color = isError ? 'var(--accent-red)' : (config.color as string || 'var(--text-primary)');
  const prefix = config.prefix as string || '';
  const suffix = config.suffix as string || '';
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        fontSize,
        fontWeight: 700,
        color,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.02em',
      }}>
        {prefix}{displayValue}{suffix}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          marginTop: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
