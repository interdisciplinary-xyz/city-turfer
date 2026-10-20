import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Starting PGlite (in-process Postgres, WASM) once per file takes over 10 s on CI runners.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
