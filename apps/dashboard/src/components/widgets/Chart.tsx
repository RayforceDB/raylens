import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { RayforceResult } from '../../lib/rayforce';

interface ChartWidgetProps {
  data: RayforceResult | unknown;
  chartType: string;
}

// OHLC data for candlestick charts
interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Helper to safely extract data from RayforceResult or raw data
function extractData(rawData: unknown): {
  categories: string[];
  values: number[];
  series: { name: string; data: number[] }[];
  ohlc?: OHLCData[];
} {
  let categories: string[] = [];
  let values: number[] = [];
  let series: { name: string; data: number[] }[] = [];
  let ohlc: OHLCData[] | undefined;

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
        data = result.toJS() as Record<string, unknown>;
      } catch (e) {
        console.error('[Chart] toJS failed:', e);
        return { categories, values, series };
      }
    } else if (result.data !== undefined) {
      data = result.data as Record<string, unknown>;
    }
  }
  
  // Now handle the actual data formats
  if (Array.isArray(data)) {
    // Array of objects (table rows)
    if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      const rows = data as Record<string, unknown>[];
      const keys = Object.keys(rows[0]).map(k => k.toLowerCase());
      const keysOriginal = Object.keys(rows[0]);

      // Check for OHLC data (candlestick)
      const hasOHLC = ['open', 'high', 'low', 'close'].every(k =>
        keys.includes(k) || keys.includes(k[0]) // Support both 'open' and 'o'
      );

      if (hasOHLC) {
        // Find the time/category column
        const timeKey = keysOriginal.find(k => {
          const kl = k.toLowerCase();
          return kl === 'time' || kl === 'ts' || kl === 'timestamp' || kl === 'date' || kl === 't';
        }) || keysOriginal[0];

        // Map column names (support both full names and abbreviations)
        const findKey = (names: string[]) =>
          keysOriginal.find(k => names.includes(k.toLowerCase())) || '';

        const openKey = findKey(['open', 'o']);
        const highKey = findKey(['high', 'h']);
        const lowKey = findKey(['low', 'l']);
        const closeKey = findKey(['close', 'c']);

        ohlc = rows.map(r => ({
          time: String(r[timeKey] ?? ''),
          open: Number(r[openKey] ?? 0),
          high: Number(r[highKey] ?? 0),
          low: Number(r[lowKey] ?? 0),
          close: Number(r[closeKey] ?? 0),
        }));

        categories = ohlc.map(d => d.time);
        return { categories, values, series, ohlc };
      }

      // Find string/category column and numeric columns
      const firstRow = rows[0];
      let categoryKey: string | null = null;
      const numericKeys: string[] = [];

      for (const key of keysOriginal) {
        const val = firstRow[key];
        if (typeof val === 'string' && !categoryKey) {
          categoryKey = key;
        } else if (typeof val === 'number') {
          numericKeys.push(key);
        }
      }

      // Use first column as category if no string column found
      if (!categoryKey) {
        categoryKey = keysOriginal[0];
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
          const v = r[keysOriginal[1] || keysOriginal[0]];
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
  
  return { categories, values, series, ohlc };
}

export function ChartWidget({ data, chartType }: ChartWidgetProps) {
  const option = useMemo((): EChartsOption => {
    const { categories, values, series, ohlc } = extractData(data);

    if (categories.length === 0 && values.length === 0 && !ohlc?.length) {
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
        // ECharts candlestick format: [open, close, low, high]
        const candleData = ohlc
          ? ohlc.map(d => [d.open, d.close, d.low, d.high])
          : values.map(v => [v, v * 1.01, v * 0.98, v * 1.02]); // Fallback for non-OHLC data
        const candleCategories = ohlc ? ohlc.map(d => d.time) : categories;

        return {
          ...baseOption,
          grid: { left: 60, right: 20, top: 40, bottom: 60 },
          xAxis: {
            type: 'category',
            data: candleCategories,
            axisLine: axisLineStyle,
            axisLabel: {
              ...baseTextStyle,
              rotate: 45,
              fontSize: 10,
            },
            splitLine: { show: false },
          },
          yAxis: {
            type: 'value',
            scale: true,
            axisLine: axisLineStyle,
            axisLabel: baseTextStyle,
            splitLine: splitLineStyle,
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            backgroundColor: '#1a1a24',
            borderColor: '#2a2a3a',
            textStyle: { color: '#e8e8ec' },
            formatter: (params: unknown) => {
              const p = (params as { data: number[]; name: string }[])[0];
              if (!p) return '';
              const [open, close, low, high] = p.data;
              return `<b>${p.name}</b><br/>
                Open: ${open?.toFixed(2)}<br/>
                High: ${high?.toFixed(2)}<br/>
                Low: ${low?.toFixed(2)}<br/>
                Close: ${close?.toFixed(2)}`;
            },
          },
          series: [{
            type: 'candlestick' as const,
            data: candleData,
            itemStyle: {
              color: '#22c55e',      // Up candle fill
              color0: '#ef4444',     // Down candle fill
              borderColor: '#22c55e', // Up candle border
              borderColor0: '#ef4444', // Down candle border
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
