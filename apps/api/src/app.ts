import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { problem } from './problem';
import { registerActivities } from './routes/activities';
import { registerIdentity } from './routes/identity';
import { registerMe } from './routes/me';
import { registerTerritory } from './routes/territory';
import { API_VERSION, OPENAPI_CONFIG, SPEC_PATH } from './spec';

/**
 * The CityTurfer API (`api-design` skill, docs/decisions/api-2026-10-20.md). Routes are driving
 * adapters over the app's use cases; most are declared and documented but still planned (501).
 */
export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono({
    // Invalid input → 400 problem. Never echo the input: it may hold coordinates.
    defaultHook: (result, c) => {
      if (!result.success) {
        const fields = [...new Set(result.error.issues.map((i) => i.path.join('.') || '(body)'))].join(', ');
        return problem(c, 400, 'invalid-request', 'Invalid request', `Check: ${fields}.`);
      }
      return undefined;
    },
  });

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'Token from POST /v1/auth/sign-in.',
  });

  app.openapi(
    createRoute({
      method: 'get',
      path: '/v1/health',
      tags: ['Platform'],
      operationId: 'getHealth',
      security: [],
      summary: 'Liveness',
      description: 'Public. Answers when the function is up; touches no data.',
      responses: {
        200: {
          description: 'Up.',
          content: {
            'application/json': {
              schema: z
                .object({
                  status: z.literal('ok'),
                  version: z.string().openapi({ example: API_VERSION }),
                })
                .openapi('Health'),
            },
          },
        },
      },
    }),
    (c) => c.json({ status: 'ok' as const, version: API_VERSION }, 200)
  );

  registerIdentity(app);
  registerActivities(app);
  registerTerritory(app);
  registerMe(app);

  app.doc31(SPEC_PATH, OPENAPI_CONFIG);
  app.get('/swagger', swaggerUI({ url: SPEC_PATH, title: 'CityTurfer API' }));

  app.notFound((c) => problem(c, 404, 'not-found', 'Not found'));
  app.onError((_err, c) => problem(c, 500, 'internal', 'Something went wrong'));
  return app;
}

export const app = createApp();
