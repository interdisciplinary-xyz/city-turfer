// Local dev server: `pnpm --filter @cityturfer/api dev` → http://localhost:8787 (Swagger at /swagger).
// The website's dev server proxies https://cityturfer.local/api/* here.
import { serve } from '@hono/node-server';

import { app } from './app';
import { LOCAL_API_PORT } from './spec';

const port = Number(process.env.PORT ?? LOCAL_API_PORT);
serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`CityTurfer API on http://localhost:${info.port} (docs: /swagger)\n`);
});
