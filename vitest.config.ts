import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration test suites run sequentially so DB truncation in the
    // setup file isolates every test deterministically.
    fileParallelism: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});