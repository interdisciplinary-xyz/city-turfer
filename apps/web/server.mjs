// Dev server for the landing page: `pnpm run web:dev` → portless → this file.
//
// It wraps Next's request handler with the dev toolbar's Node half
// (`@interdisciplinary/dev-toolbar/node`): every request is marked local / not local (the
// toolbar renders only for this machine, not for phones on the portless `--lan` URL), and the
// toolbar's request logger and route map get their `/__dev/*` endpoints. Production never runs
// this: the site is a static export (`next build` → out/).
import { createServer } from 'node:http';
import path from 'node:path';

import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '127.0.0.1';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const nextHandler = app.getRequestHandler();

const devNode = dev ? await import('@interdisciplinary/dev-toolbar/node') : null;
const handler = devNode
  ? devNode.withDevRequestLog(nextHandler, { port, appDir: path.join(process.cwd(), 'src/app') })
  : nextHandler;

await app.prepare();
createServer(handler)
  .once('error', (err) => {
    console.error(err);
    process.exit(1);
  })
  .listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
