import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run test files sequentially (one at a time) to prevent SQLite write conflicts
    // and plugin singleton state leakage between parallel test files.
    fileParallelism: false,
    // Keep tests within each file running in order
    sequence: {
      shuffle: false,
    },
    // Global timeout per test
    testTimeout: 30000,
  },
});
