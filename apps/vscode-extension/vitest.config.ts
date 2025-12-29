import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 30000,
    teardownTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/adapters/**/*.ts'],
      exclude: [
        'src/adapters/**/*.test.ts',
        'src/adapters/**/*.spec.ts',
        'src/adapters/__tests__/**'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    },
    setupFiles: ['./vitest.setup.ts']
  },
  resolve: {
    alias: {
      '@dbview/types': path.resolve(__dirname, '../../packages/types/src'),
      '@': path.resolve(__dirname, './src')
    }
  }
});
