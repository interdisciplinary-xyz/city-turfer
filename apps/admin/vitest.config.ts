import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@payload-config': path.resolve(dirname, 'src/payload.config.ts') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Starting Payload (imports, Postgres connection, migrations) takes well over 10 s on CI runners
    // while turbo runs every workspace's tests at once; the same limits as apps/api.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
