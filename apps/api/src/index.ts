// Vercel entry. `pnpm run build` (vercel.json buildCommand) bundles this file with esbuild into
// dist/index.mjs, which the zero-config Hono builder picks up (outputDirectory: dist); see
// scripts/build.ts for why. Local development uses src/server.ts.
import { createApp } from './app';
import { productionDeps } from './wiring';

const app = createApp(productionDeps(process.env));

export default app;
