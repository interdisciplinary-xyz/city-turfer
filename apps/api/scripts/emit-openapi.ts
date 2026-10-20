// Writes the OpenAPI 3.1 document generated from the routes to apps/api/openapi.json.
//   pnpm --filter @cityturfer/api run openapi           # write
//   pnpm --filter @cityturfer/api run openapi --check   # fail if the committed file is stale
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createApp } from '../src/app';
import { OPENAPI_CONFIG } from '../src/spec';

const out = path.join(import.meta.dirname, '..', 'openapi.json');
const doc = createApp().getOpenAPI31Document(OPENAPI_CONFIG);
const json = `${JSON.stringify(doc, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(out, 'utf8');
  if (current !== json) {
    console.error('apps/api/openapi.json is stale: run `pnpm --filter @cityturfer/api run openapi`.');
    process.exit(1);
  }
  console.log('apps/api/openapi.json is up to date.');
} else {
  writeFileSync(out, json);
  console.log(`Wrote ${path.relative(process.cwd(), out)} (${Object.keys(doc.paths ?? {}).length} paths).`);
}
