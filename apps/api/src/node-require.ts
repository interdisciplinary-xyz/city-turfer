// Gives ES modules run by tsx (the local server, support scripts) a CommonJS `require`, as the
// Vercel bundle's banner does (scripts/build.ts) and Vitest does: @cityturfer/core's h3 loader
// (packages/core/src/h3/h3.ts) calls `require('h3-js')` to hide TextDecoder from it on Hermes.
// Import it first, before anything that loads @cityturfer/core/h3.
import { createRequire } from 'node:module';

const g = globalThis as { require?: unknown };
g.require ??= createRequire(import.meta.url);
