import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests of the portal's TypeScript (src/**/*.test.ts): API client, error mapping, `next`
// guard, copy keys. tools/__tests__ run separately under node:test (package.json test:unit).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
