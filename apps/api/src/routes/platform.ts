import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { Health } from '../schemas/platform';
import { API_VERSION } from '../spec';
import { defineRoute } from './define';

/** Platform: liveness and database reachability. */
export function registerPlatform(app: OpenAPIHono<AppEnv>): void {
  defineRoute(
    app,
    {
      status: 'live',
      method: 'get',
      path: '/v1/health',
      tags: ['Platform'],
      operationId: 'getHealth',
      security: [],
      summary: 'Liveness and database reachability',
      description:
        'Public. Answers `200` when the function is up; `database` tells whether the database answers a trivial query (it reads no user data and reveals no details).',
      responses: {
        200: { description: 'Up.', content: { 'application/json': { schema: Health } } },
      },
    },
    async (c) => {
      const { store } = c.var.deps;
      const database = !store ? 'not-configured' : (await withTimeout(store.ping(), 3000)) ? 'ok' : 'unreachable';
      return c.json({ status: 'ok' as const, version: API_VERSION, database }, 200);
    }
  );
}

/** False when the promise does not resolve true within `ms`. */
function withTimeout(promise: Promise<boolean>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([promise.catch(() => false), timeout]).finally(() => clearTimeout(timer));
}
