import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000
  },
  resolve: {
    alias: {
      '@dbview/types': path.resolve(__dirname, '../types/src'),
      '@dbview/adapters': path.resolve(__dirname, './src')
    }
  }
});
