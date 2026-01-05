import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { RayforceResult } from '../../lib/rayforce';

interface ChartWidgetProps {
  data: RayforceResult | unknown;
  chartType: string;
}

// Helper to safely extract data from RayforceResult or raw data
function extractData(rawData: unknown): { categories: string[]; values: number[]; series: { name: string; data: number[] }[] } {
  let categories: string[] = [];
  let values: number[] = [];
  let series: { name: string; data: number[] }[] = [];
  
  if (!rawData) {
    return { categories, values, series };
  }
  
  // Check if it's a RayforceResult with toJS
  let data = rawData;
  if (typeof rawData === 'object' && rawData !== null) {
    const result = rawData as RayforceResult;
    
    // Handle error type
    if (result.type === 'error') {
      return { categories, values, series };
    }
    
    // Handle scalar type
    if (result.type === 'scalar') {
      const val = result.data ?? (result.toJS ? result.toJS() : null);
      if (typeof val === 'number') {
        categories = ['Value'];
        values = [val];
      }
      return { categories, values, series };
    }
    
    // Try to get JS data
    if (result.toJS) {
      try {
        data = result.toJS();
      } catch (e) {
        console.error('[Chart] toJS failed:', e);
        return { categories, values, series };
      }
    } else if (result.data !== undefined) {
      data = result.data;
    }
  }
  
  // Now handle the actual data formats
  if (Array.isArray(data)) {
    // Array of objects (table rows)
    if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      const rows = data as Record<string, unknown>[];
      const keys = Object.keys(rows[0]);
      
      // Find string/category column and numeric columns
      const firstRow = rows[0];
      let categoryKey: string | null = null;
      const numericKeys: string[] = [];
      
      for (const key of keys) {
        const val = firstRow[key];
        if (typeof val === 'string' && !categoryKey) {
          categoryKey = key;
        } else if (typeof val === 'number') {
          numericKeys.push(key);
        }
      }
      
      // Use first column as category if no string column found
      if (!categoryKey) {
        categoryKey = keys[0];
      }
      
      categories = rows.map(r => String(r[categoryKey!] ?? ''));
      
      if (numericKeys.length === 1) {
        values = rows.map(r => Number(r[numericKeys[0]] ?? 0));
      } else if (numericKeys.length > 1) {
        series = numericKeys.map(key => ({
          name: key,
          data: rows.map(r => Number(r[key] ?? 0)),
        }));
        values = series[0]?.data || [];
      } else {
        // No numeric column, try to use values as numbers
        values = rows.map(r => {
          const v = r[keys[1] || keys[0]];
          return typeof v === 'number' ? v : 0;
        });
      }
    } else {
      // Array of primitives
      categories = data.map((_, i) => String(i));
      values = data.map(v => (typeof v === 'number' ? v : Number(v) || 0));
    }
  } else if (typeof data === 'object' && data !== null) {
    // Object/dict format
    const dict = data as Record<string, unknown>;
    const keys = Object.keys(dict);
    
    if (keys.length >= 1) {
      const firstVal = dict[keys[0]];
      
      if (Array.isArray(firstVal)) {
        // Column-oriented data
        categories = (dict[keys[0]] as unknown[]).map(String);
        if (keys.length >= 2) {
          const numericKeys = keys.filter(k => {
            const arr = dict[k];
            return Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'number';
          });
          
          if (numericKeys.length === 1) {
            values = (dict[numericKeys[0]] as number[]);
          } else if (numericKeys.length > 1) {
            series = numericKeys.map(key => ({
              name: key,
              data: dict[key] as number[],
            }));
            values = series[0]?.data || [];
          } else {
            values = (dict[keys[1] || keys[0]] as unknown[]).map(v => Number(v) || 0);
          }
        }
      } else {
        // Key-value pairs
        categories = keys;
        values = keys.map(k => Number(dict[k]) || 0);
      }
    }
  } else if (typeof data === 'number') {
    categories = ['Value'];
    values = [data];
  }
  
  return { categories, values, series };
}

export function ChartWidget({ data, chartType }: ChartWidgetProps) {
  const option = useMemo((): EChartsOption => {
    const { categories, values, series } = extractData(data);
    
    if (categories.length === 0 && values.length === 0) {
      return {
        title: {
          text: 'No data',
          left: 'center',
          top: 'center',
          textStyle: { color: '#666', fontSize: 14 },
        },
      };
    }
    
    const baseTextStyle = { color: '#9898a8' };
    const axisLineStyle = { lineStyle: { color: '#2a2a3a' } };
    const splitLineStyle = { lineStyle: { color: '#1a1a24' } };
    
    const baseOption: EChartsOption = {
      backgroundColor: 'transparent',
      textStyle: baseTextStyle,
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      tooltip: {
        trigger: chartType === 'pie' ? 'item' : 'axis',
        backgroundColor: '#1a1a24',
        borderColor: '#2a2a3a',
        textStyle: { color: '#e8e8ec' },
      },
    };
    
    switch (chartType) {
      case 'line':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: categories,
            axisLine: axisLineStyle,
            axisLabel: baseTextStyle,
          },
          yAxis: {
            type: 'value',
            axisLine: axisLineStyle,
            axisLabel: baseTextStyle,
            splitLine: splitLineStyle,
          },
          series: series.length > 0
            ? series.map((s, i) => ({
                name: s.name,
                type: 'line' as const,
                data: s.data,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { color: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'][i % 5] },
                itemStyle: { color: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'][i % 5] },
              }))
            : [{
                type: 'line' as const,
                data: values,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { color: '#3b82f6' },
                itemStyle: { color: '#3b82f6' },
                areaStyle: { color: 'rgba(59, 130, 246, 0.1)' },
              }],
          legend: series.length > 0 ? { top: 10, textStyle: baseTextStyle } : undefined,
        };
        
      case 'bar':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: categories,
            axisLine: axisLineStyle,
            axisLabel: { ...baseTextStyle, rotate: categories.length > 5 ? 45 : 0 },
          },
          yAxis: {
            type: 'value',
            axisLine: axisLineStyle,
            axisLabel: baseTextStyle,
            splitLine: splitLineStyle,
          },
          series: series.length > 0
            ? series.map((s, i) => ({
                name: s.name,
                type: 'bar' as const,
                data: s.data,
                itemStyle: { color: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'][i % 5] },
              }))
            : [{
                type: 'bar' as const,
                data: values,
                itemStyle: { 
                  color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                      { offset: 0, color: '#3b82f6' },
                      { offset: 1, color: '#1d4ed8' },
                    ],
                  },
                },
              }],
          legend: series.length > 0 ? { top: 10, textStyle: baseTextStyle } : undefined,
        };
        
      case 'pie':
        const pieData = categories.map((name, i) => ({
          name: name || `Item ${i + 1}`,
          value: values[i] || 0,
        })).filter(d => d.value > 0);
        
        return {
          ...baseOption,
          series: [{
            type: 'pie' as const,
            radius: ['40%', '70%'],
            center: ['50%', '55%'],
            data: pieData,
            label: { 
              color: '#9898a8',
              formatter: '{b}: {d}%',
            },
            emphasis: {
              label: { show: true, fontWeight: 'bold' },
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
            itemStyle: {
              borderRadius: 4,
              borderColor: '#12121a',
              borderWidth: 2,
            },
          }],
          legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            textStyle: baseTextStyle,
          },
          color: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#8b5cf6'],
        };
        
      case 'candle':
      case 'candlestick':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: categories,
            axisLine: axisLineStyle,
            axisLabel: baseTextStyle,
          },
          yAxis: {
            type: 'value',
            scale: true,
            axisLine: axisLineStyle,
            axisLabel: baseTextStyle,
            splitLine: splitLineStyle,
          },
          series: [{
            type: 'candlestick' as const,
            data: values.map((v, i) => [v, v * 1.02, v * 0.98, v * 1.01]),
            itemStyle: {
              color: '#22c55e',
              color0: '#ef4444',
              borderColor: '#22c55e',
              borderColor0: '#ef4444',
            },
          }],
        };
        
      case 'area':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: categories,
            axisLine: axisLineStyle,
            axisLabel: baseTextStyle,
            boundaryGap: false,
          },
          yAxis: {
            type: 'value',
            axisLine: axisLineStyle,
            axisLabel: baseTextStyle,
            splitLine: splitLineStyle,
          },
          series: [{
            type: 'line' as const,
            data: values,
            smooth: true,
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
                  { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
                ],
              },
            },
            lineStyle: { color: '#3b82f6' },
            itemStyle: { color: '#3b82f6' },
          }],
        };
        
      default:
        return {
          ...baseOption,
          xAxis: { type: 'category', data: categories, axisLabel: baseTextStyle },
          yAxis: { type: 'value', axisLabel: baseTextStyle },
          series: [{ type: 'line' as const, data: values }],
        };
    }
  }, [data, chartType]);
  
  // Check for error or no data
  if (!data) {
    return (
      <div className="widget-placeholder">
        No data - bind a query to this widget
      </div>
    );
  }
  
  const result = data as RayforceResult;
  if (result.type === 'error') {
    return (
      <div className="widget-error">
        Error: {String(result.data)}
      </div>
    );
  }
  
  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge={true}
    />
  );
}
