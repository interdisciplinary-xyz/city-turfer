// Bundles the Vercel entry (src/index.ts) into dist/index.mjs:
//   pnpm --filter @cityturfer/api run build
//
// Why: Vercel's zero-config Hono builder transpiles each .ts file on its own and keeps
// extensionless ESM imports (`./app`), which Node cannot resolve at runtime, and it cannot run the
// TypeScript source of the workspace package @cityturfer/core. Checked with `vercel build`
// (CLI 64.7, @vercel/hono 20): the unbundled function fails with ERR_MODULE_NOT_FOUND. So we bundle
// everything ourselves (core included) and vercel.json points the Hono builder at dist/
// (`outputDirectory`), where it finds index.mjs: it imports `hono`, which stays external so the
// builder recognises the entry and traces hono from node_modules.
import { rmSync } from 'node:fs';
import path from 'node:path';

import { build } from 'esbuild';

const root = path.join(import.meta.dirname, '..');
const outdir = path.join(root, 'dist');
rmSync(outdir, { recursive: true, force: true });

const result = await build({
  entryPoints: [path.join(root, 'src', 'index.ts')],
  outfile: path.join(outdir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // `hono` stays a plain import: the Vercel Hono builder detects its entry by `from "hono"`.
  external: ['hono', 'hono/*'],
  // CommonJS inside an ESM bundle may call require(). Checked 2026-10-23: the only calls left are
  // h3-js's emscripten loader (`require("fs")`, `require("path")` in its file reader, not reached
  // while the memory image is an embedded data URI); without the banner they would throw "Dynamic
  // require … is not supported" if ever reached. Kept as that safety net.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  sourcemap: true,
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
});

const inputs = Object.keys(result.metafile.inputs);
if (inputs.some((i) => i.includes('pglite'))) {
  console.error('dist/index.mjs must not contain PGlite (dev and tests only).');
  process.exit(1);
}
const core = inputs.filter((i) => i.includes('packages/core/')).length;
const bytes = Object.values(result.metafile.outputs).reduce((s, o) => s + o.bytes, 0);
console.log(`Wrote dist/index.mjs (${Math.round(bytes / 1024)} KiB incl. map; ${core} files of @cityturfer/core).`);
