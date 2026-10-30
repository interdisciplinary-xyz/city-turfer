// Dev server for the landing page: `pnpm run web:dev` → portless → this file.
//
// It wraps Next's request handler with the dev toolbar's Node half
// (`@interdisciplinary/dev-toolbar/node`): every request is marked local / not local (the
// toolbar renders only for this machine, not for phones on the portless `--lan` URL), and the
// toolbar's request logger and route map get their `/__dev/*` endpoints. Production never runs
// this: the site is a static export (`next build` → out/).
//
// It also serves the design system's Storybook build at /storybook (tools/storybook-route.mjs), and
// the API's Swagger docs at /swagger plus a proxy from /api/* to the API dev server
// (tools/swagger-route.mjs), with the CityTurfer skin and the dev toolbar, and the staff admin at
// /admin, proxied to the admin's dev server (tools/admin-route.mjs). Those pages, and /branding,
// answer only this machine, like the toolbar (tools/local-only-route.mjs).
import { readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

import next from 'next';

import { routeAdminUpgrades, withAdmin } from './tools/admin-route.mjs';
import { withLocalOnly } from './tools/local-only-route.mjs';
import { withStorybook } from './tools/storybook-route.mjs';
import { withSwagger } from './tools/swagger-route.mjs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '127.0.0.1';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const nextHandler = app.getRequestHandler();

const devNode = dev ? await import('@interdisciplinary/dev-toolbar/node') : null;
const siteHandler = devNode
  ? devNode.withDevRequestLog(nextHandler, { port, appDir: path.join(process.cwd(), 'src/app') })
  : nextHandler;
const storybookBuild = path.join(process.cwd(), '../storybook/storybook-static');
// Every language is a URL prefix (`/en`, `/pl`), one messages file each.
const locales = readdirSync(path.join(process.cwd(), 'messages'))
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length));
const handler = devNode
  ? withLocalOnly(
      withAdmin(
        withSwagger(
          withStorybook(siteHandler, storybookBuild, { isLocal: devNode.isLocalClient, webRoot: process.cwd() }),
          {
            // Resolved only in dev: swagger-ui-dist is a dev dependency.
            distRoot: path.dirname(createRequire(import.meta.url).resolve('swagger-ui-dist/package.json')),
            specFile: path.join(process.cwd(), '../api/openapi.json'),
            apiUrl: process.env.API_URL,
            webRoot: process.cwd(),
            brandDir: path.join(process.cwd(), '../../packages/brand/svg'),
            fontsDir: path.join(process.cwd(), '../../packages/brand/fonts'),
            // Same rule as the site's toolbar: only requests from this machine.
            isLocal: devNode.isLocalClient,
          }
        ),
        { adminUrl: process.env.ADMIN_DEV_URL }
      ),
      { isLocal: devNode.isLocalClient, locales }
    )
  : siteHandler;

await app.prepare();
const server = createServer(handler);
if (devNode) {
  routeAdminUpgrades(server, { adminUrl: process.env.ADMIN_DEV_URL, isLocal: devNode.isLocalClient });
}
server
  .once('error', (err) => {
    console.error(err);
    process.exit(1);
  })
  .listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
