import { swaggerUI, type SwaggerUIOptions } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { AppError } from './backup/app-error';
import { type ApiDeps, type AppEnv, defaultDeps } from './deps';
import { isProblemCode } from './errors';
import { describeError, inflateGzip, limitBody, logRequests } from './middleware';
import { MAX_FIELD_ERRORS, problem } from './problem';
import { registerActivities } from './routes/activities';
import { registerIdentity } from './routes/identity';
import { registerInternal } from './routes/internal';
import { registerPlatform } from './routes/platform';
import { registerPrivacy } from './routes/privacy';
import { registerSync } from './routes/sync';
import { registerTerritory } from './routes/territory';
import { registerHeaders } from './schemas/common';
import { OPENAPI_CONFIG, SPEC_PATH, SWAGGER_UI_OPTIONS } from './spec';

/**
 * SWAGGER_UI_OPTIONS for @hono/swagger-ui. Its 0.6.1 types declare `syntaxHighlight.theme` as
 * `string[]`, but Swagger UI reads one theme name (it ships 'idea'), and the middleware passes the
 * object through JSON.stringify unchanged; hence the one cast.
 */
function swaggerUiOptions(): Omit<SwaggerUIOptions, 'url'> {
  const { syntaxHighlight, ...rest } = SWAGGER_UI_OPTIONS;
  return { ...rest, syntaxHighlight: syntaxHighlight as unknown as SwaggerUIOptions['syntaxHighlight'] };
}

/**
 * The CityTurfer API (`api-design` skill, docs/decisions/api-sync-2026-10-20.md). Routes are
 * driving adapters over the app's use cases (backup: src/backup/); the rest are declared and
 * documented but still planned (501). Order per request: request id → log → secure headers → body
 * limit → gzip → (route) auth → (live routes) database + user → validation → handler.
 */
export function createApp(deps: ApiDeps = defaultDeps()): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>({
    // Invalid input → 400 problem with JSON pointers. Never echo the input: it may hold coordinates.
    // At most MAX_FIELD_ERRORS pointers: a 40,000-point track with a bad column must not answer megabytes.
    defaultHook: (result, c) => {
      if (!result.success) {
        const issues = result.error.issues;
        const errors = issues.slice(0, MAX_FIELD_ERRORS).map((i) => ({
          pointer: `/${i.path.map((p) => String(p).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`,
          code: i.code,
        }));
        const more = issues.length > errors.length ? ` (${issues.length - errors.length} more)` : '';
        return problem(
          c,
          'invalid-request',
          `Check: ${[...new Set(errors.map((e) => e.pointer))].join(', ')}${more}.`,
          { errors }
        );
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
    description:
      'A session token from `POST /v1/auth/sign-in` (e-mailed code, about 60 days, sliding), or — for one more release — a device token minted with `pnpm --filter @cityturfer/api run token:new -- <userId>` (the server knows only its SHA-256, env `API_TOKENS`).',
  });
  registerHeaders(app.openAPIRegistry);

  registerPlatform(app);
  registerIdentity(app);
  registerPrivacy(app);
  registerSync(app);
  registerActivities(app);
  registerTerritory(app);
  registerInternal(app);

  app.doc31(SPEC_PATH, OPENAPI_CONFIG);
  app.get('/swagger', swaggerUI({ url: SPEC_PATH, title: 'CityTurfer API', ...swaggerUiOptions() }));

  app.notFound((c) => problem(c, 'not-found'));
  app.onError((err, c) => {
    // A use case's refusal (AppError) or a broken domain rule (DomainError from @cityturfer/core)
    // carries a catalogue code: answer it, e.g. 403/410/412/422. Anything else is a 500 that says
    // nothing to the caller and logs one sanitised line (describeError: no message, no data).
    if (err instanceof AppError) {
      return problem(c, err.code, undefined, { headers: err.headers });
    }
    const code = (err as { code?: unknown }).code;
    if (err.name === 'DomainError' && isProblemCode(code)) {
      return problem(c, code);
    }
    c.var.deps.log.event?.({
      msg: 'request.error',
      requestId: c.var.requestId,
      method: c.req.method,
      route: c.req.routePath,
      ...describeError(err),
    });
    return problem(c, 'internal');
  });
  return app;
}
