import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Base path for GitHub Pages deployment
  // Set VITE_BASE_PATH env var for production builds (e.g., /raylens/)
  base: process.env.VITE_BASE_PATH || '/',
  
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@utils': resolve(__dirname, './src/utils'),
    },
  },

  // Required for SharedArrayBuffer (crossOriginIsolated)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // Web Worker configuration
  worker: {
    format: 'es',
    plugins: () => [react()],
  },

  // Optimizations
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'chart-vendor': ['uplot', 'echarts'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
          ],
          'dnd-vendor': [
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities',
          ],
        },
      },
    },
  },

  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },

  // Ensure WASM files are served correctly
  assetsInclude: ['**/*.wasm'],
});
