import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { Health } from '../schemas/platform';
import { API_VERSION } from '../spec';
import { defineRoute } from './define';

/** Platform: liveness. */
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
      summary: 'Liveness',
      description: 'Public. Answers when the function is up; touches no data.',
      responses: {
        200: { description: 'Up.', content: { 'application/json': { schema: Health } } },
      },
    },
    (c) => c.json({ status: 'ok' as const, version: API_VERSION }, 200)
  );
}
