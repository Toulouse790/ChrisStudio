import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/tests/**',
        'src/cli.ts',
        'src/index.ts'
      ],
      thresholds: {
        lines: 7,
        functions: 35,
        branches: 55,
        statements: 7
      }
    },
    testTimeout: 30000
  }
});
