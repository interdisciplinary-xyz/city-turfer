import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@payload-config': path.resolve(dirname, 'src/payload.config.ts') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
