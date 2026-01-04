/**
 * ChartCanvas - Main chart rendering area
 * Uses ECharts for rendering
 */

import { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import type { EncodedField } from './EncodingShelf';

type ChartType = 'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'heatmap';

interface ChartCanvasProps {
  title?: string;
  chartType: ChartType;
  rows: EncodedField[];
  columns: EncodedField[];
  values: EncodedField[];
  colorField: EncodedField | undefined;
  data?: Record<string, unknown>[];
}

// Color palette - Tableau-inspired
const COLORS = [
  '#4e79a7', // steel blue
  '#f28e2b', // orange
  '#76b7b2', // teal
  '#e15759', // red
  '#59a14f', // green
  '#edc948', // yellow
  '#b07aa1', // purple
  '#ff9da7', // pink
  '#9c755f', // brown
  '#bab0ac', // gray
];

export function ChartCanvas({
  title,
  chartType,
  rows,
  columns,
  values,
  colorField: _colorField,
  data = [],
}: ChartCanvasProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Generate mock data if no real data provided
  const chartData = useMemo(() => {
    if (data.length > 0) return data;

    // Generate sample data for demonstration
    if (rows.length === 0 && columns.length === 0 && values.length === 0) {
      return [];
    }

    // FAA Wildlife Strikes - Species count data
    const speciesData = [
      { category: 'Unknown bird - small', value: 14521 },
      { category: 'Unknown bird', value: 11023 },
      { category: 'Mourning dove', value: 6847 },
      { category: 'Unknown bird - medium', value: 5234 },
      { category: 'Barn swallow', value: 3912 },
      { category: 'Killdeer', value: 3245 },
      { category: 'Horned lark', value: 2987 },
      { category: 'American kestrel', value: 2654 },
      { category: 'European starling', value: 2432 },
      { category: 'Eastern meadowlark', value: 1987 },
      { category: 'Red-tailed hawk', value: 1876 },
      { category: 'Rock pigeon', value: 1654 },
      { category: 'Gulls', value: 1543 },
      { category: 'Cliff swallow', value: 1432 },
      { category: 'Sparrows', value: 1321 },
      { category: 'Unknown bird - large', value: 1234 },
      { category: 'Western meadowlark', value: 1123 },
      { category: 'American robin', value: 1098 },
      { category: 'Ring-billed gull', value: 987 },
      { category: 'Barn owl', value: 876 },
    ];

    return speciesData.map((item) => ({
      ...item,
      secondary: Math.floor(Math.random() * item.value * 0.5),
    }));
  }, [data, rows, columns, values]);

  // Build ECharts option
  const option = useMemo(() => {
    if (chartData.length === 0) return null;

    const categoryField = rows[0]?.name || 'category';
    const valueField = values[0]?.name || 'value';

    const categories = chartData.map((d) => (d as Record<string, unknown>)[categoryField] ?? (d as Record<string, unknown>).category);
    const seriesData = chartData.map((d) => (d as Record<string, unknown>)[valueField] ?? (d as Record<string, unknown>).value);

    const baseOption: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#9ca3af',
      },
      ...(title && {
        title: {
          text: title,
          left: 'center',
          textStyle: {
            color: '#f3f4f6',
            fontSize: 16,
            fontWeight: 500,
          },
        },
      }),
      tooltip: {
        trigger: chartType === 'pie' ? 'item' : 'axis',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: '#374151',
        textStyle: {
          color: '#f3f4f6',
        },
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '10%',
        top: title ? '15%' : '5%',
        containLabel: true,
      },
      color: COLORS,
    };

    switch (chartType) {
      case 'bar':
        return {
          ...baseOption,
          xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#1f2937' } },
          },
          yAxis: {
            type: 'category',
            data: categories,
            axisLine: { lineStyle: { color: '#374151' } },
            axisLabel: {
              width: 150,
              overflow: 'truncate',
              color: '#9ca3af',
            },
            inverse: true,
          },
          series: [
            {
              type: 'bar',
              data: seriesData,
              itemStyle: {
                color: COLORS[0],
                borderRadius: [0, 4, 4, 0],
              },
              emphasis: {
                itemStyle: {
                  color: COLORS[0],
                  opacity: 0.8,
                },
              },
            },
          ],
        };

      case 'line':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: categories,
            axisLine: { lineStyle: { color: '#374151' } },
            axisLabel: { color: '#9ca3af', rotate: 45 },
          },
          yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#1f2937' } },
          },
          series: [
            {
              type: 'line',
              data: seriesData,
              smooth: true,
              lineStyle: { width: 2 },
              areaStyle: undefined,
              itemStyle: { color: COLORS[0] },
            },
          ],
        };

      case 'area':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: categories,
            boundaryGap: false,
            axisLine: { lineStyle: { color: '#374151' } },
            axisLabel: { color: '#9ca3af', rotate: 45 },
          },
          yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#1f2937' } },
          },
          series: [
            {
              type: 'line',
              data: seriesData,
              smooth: true,
              lineStyle: { width: 2 },
              areaStyle: {
                opacity: 0.3,
              },
              itemStyle: { color: COLORS[0] },
            },
          ],
        };

      case 'scatter':
        return {
          ...baseOption,
          xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#1f2937' } },
          },
          yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#374151' } },
            splitLine: { lineStyle: { color: '#1f2937' } },
          },
          series: [
            {
              type: 'scatter',
              data: chartData.map((d, i) => [
                d.value || i * 1000,
                d.secondary || Math.random() * 10000,
              ]),
              symbolSize: 10,
              itemStyle: { color: COLORS[0] },
            },
          ],
        };

      case 'pie':
        return {
          ...baseOption,
          series: [
            {
              type: 'pie',
              radius: ['40%', '70%'],
              center: ['50%', '55%'],
              data: chartData.slice(0, 8).map((d, i) => ({
                name: (d as Record<string, unknown>)[categoryField] ?? (d as Record<string, unknown>).category,
                value: (d as Record<string, unknown>)[valueField] ?? (d as Record<string, unknown>).value,
                itemStyle: { color: COLORS[i % COLORS.length] },
              })),
              label: {
                color: '#9ca3af',
                fontSize: 11,
              },
              labelLine: {
                lineStyle: { color: '#4b5563' },
              },
            },
          ],
        };

      case 'heatmap':
        const xData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const yData = ['Morning', 'Noon', 'Afternoon', 'Evening', 'Night'];
        const heatmapData: [number, number, number][] = [];
        for (let i = 0; i < xData.length; i++) {
          for (let j = 0; j < yData.length; j++) {
            heatmapData.push([i, j, Math.floor(Math.random() * 100)]);
          }
        }
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: xData,
            axisLine: { lineStyle: { color: '#374151' } },
          },
          yAxis: {
            type: 'category',
            data: yData,
            axisLine: { lineStyle: { color: '#374151' } },
          },
          visualMap: {
            min: 0,
            max: 100,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '2%',
            inRange: {
              color: ['#1f2937', COLORS[0]],
            },
            textStyle: { color: '#9ca3af' },
          },
          series: [
            {
              type: 'heatmap',
              data: heatmapData,
              label: {
                show: true,
                color: '#f3f4f6',
              },
            },
          ],
        };

      default:
        return baseOption;
    }
  }, [chartType, chartData, title, rows, values]);

  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
    }

    if (option) {
      chartInstance.current.setOption(option, true);
    }

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [option]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  // Empty state
  if (rows.length === 0 && columns.length === 0 && values.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            Create a Visualization
          </h3>
          <p className="text-sm text-gray-500">
            Drag fields from the Data panel to Columns, Rows, or Values to create your visualization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      className="w-full h-full min-h-[400px]"
      style={{ background: 'transparent' }}
    />
  );
}
