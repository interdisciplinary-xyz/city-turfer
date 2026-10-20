import { createRoute, type OpenAPIHono, type RouteConfig } from '@hono/zod-openapi';
import type { Context } from 'hono';

import { problem } from '../problem';
import { NOT_IMPLEMENTED, PLANNED } from '../schemas/common';

/**
 * Declares a route with its full contract (so Swagger shows it) and answers 501 until it's built.
 * Marked `x-cityturfer-status: planned` in the spec.
 */
export function registerPlanned(app: OpenAPIHono, config: RouteConfig): void {
  const route = createRoute({ ...config, ...PLANNED, responses: { ...config.responses, ...NOT_IMPLEMENTED } });
  // The 501 body isn't one of the success responses the route promises; the cast keeps the
  // declared contract while the handler is a placeholder.
  app.openapi(route, ((c: Context) =>
    problem(
      c,
      501,
      'not-implemented',
      'Not implemented yet',
      'Planned route: see docs/decisions/api-2026-10-20.md.'
    )) as never);
}
