import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { type ApiDeps, type AppEnv, defaultDeps } from './deps';
import { isProblemCode } from './errors';
import { inflateGzip, limitBody, logRequests } from './middleware';
import { problem } from './problem';
import { registerAchievements } from './routes/achievements';
import { registerActivities } from './routes/activities';
import { registerIdentity } from './routes/identity';
import { registerPlatform } from './routes/platform';
import { registerPrivacy } from './routes/privacy';
import { registerTerritory } from './routes/territory';
import { registerHeaders } from './schemas/common';
import { OPENAPI_CONFIG, SPEC_PATH, SWAGGER_UI_OPTIONS } from './spec';

/**
 * The CityTurfer API (`api-design` skill, docs/decisions/api-sync-2026-10-20.md). Routes are
 * driving adapters over the app's use cases; most are declared and documented but still planned
 * (501). Order per request: request id → log → secure headers → body limit → gzip → (route) auth →
 * validation → handler.
 */
export function createApp(deps: ApiDeps = defaultDeps()): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>({
    // Invalid input → 400 problem with JSON pointers. Never echo the input: it may hold coordinates.
    defaultHook: (result, c) => {
      if (!result.success) {
        const errors = result.error.issues.map((i) => ({
          pointer: `/${i.path.map((p) => String(p).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`,
          code: i.code,
        }));
        return problem(c, 'invalid-request', `Check: ${[...new Set(errors.map((e) => e.pointer))].join(', ')}.`, {
          errors,
        });
      }
      return undefined;
    },
  });

  app.use('*', requestId());
  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });
  app.use('*', logRequests);
  app.use('*', secureHeaders());
  app.use('/v1/*', limitBody);
  app.use('/v1/*', inflateGzip);

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'Token from POST /v1/auth/sign-in (mock, dev only; Better Auth later).',
  });
  registerHeaders(app.openAPIRegistry);

  registerPlatform(app);
  registerIdentity(app);
  registerActivities(app);
  registerTerritory(app);
  registerAchievements(app);
  registerPrivacy(app);

  app.doc31(SPEC_PATH, OPENAPI_CONFIG);
  app.get('/swagger', swaggerUI({ url: SPEC_PATH, title: 'CityTurfer API', ...SWAGGER_UI_OPTIONS }));

  app.notFound((c) => problem(c, 'not-found'));
  app.onError((err, c) => {
    // A DomainError (later from @cityturfer/core) carries a catalogue code: answer it, e.g. 422.
    const code = (err as { code?: unknown }).code;
    if (err.name === 'DomainError' && isProblemCode(code)) {
      return problem(c, code);
    }
    return problem(c, 'internal');
  });
  return app;
}

export const app = createApp();
