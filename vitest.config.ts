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
      'test/build/**/*.test.{ts,tsx}',
    ],
    exclude: ['test/e2e/**', 'node_modules/**', 'out/**', 'release/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // src/main/** is deliberately INCLUDED. Excluding it made the
      // headline number describe only the renderer + shared layers,
      // which cut both ways: the four data clients under src/main/data
      // have real unit suites that counted for nothing, while
      // src/main/index.ts — the largest file in the project — was
      // credited by nothing because it was measured by nothing. The
      // testing.md target is "line coverage of src/", so measure src/.
      //
      // src/preload stays out: it is a contextBridge manifest that
      // only executes inside a real Electron preload context, so it is
      // covered by E2E or not at all.
      exclude: ['src/**/*.d.ts', 'src/preload/**'],
    },
  },
});
