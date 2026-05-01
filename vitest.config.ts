import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: [
      'test/unit/**/*.test.{ts,tsx}',
      'test/component/**/*.test.{ts,tsx}',
      'test/integration/**/*.test.{ts,tsx}',
    ],
    exclude: ['test/e2e/**', 'node_modules/**', 'out/**', 'release/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main/**', 'src/preload/**'],
    },
  },
});
