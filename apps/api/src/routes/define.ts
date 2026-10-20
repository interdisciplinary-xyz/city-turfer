import { createRoute, type OpenAPIHono, type RouteConfig } from '@hono/zod-openapi';
import type { Context } from 'hono';

import type { AppEnv } from '../deps';
import { requireBearer, requireStore } from '../middleware';
import { problem } from '../problem';
import { BEARER_AUTH, NOT_IMPLEMENTED, PLANNED, UNAVAILABLE } from '../schemas/common';

export type RouteStatus = 'planned' | 'live';

export interface RouteSpec extends Omit<RouteConfig, 'middleware'> {
  /** `planned`: declared with its full contract, answers 501 until built. */
  status: RouteStatus;
}

type Handler = (c: Context<AppEnv>) => Response | Promise<Response>;

/** The validated input of a live handler (validation ran in the route; the schema gives the type). */
export function valid<T>(c: Context<AppEnv>, target: 'json' | 'param' | 'query' | 'header'): T {
  return c.req.valid(target as never) as T;
}

/**
 * Declares one /v1 route: the contract for the spec, auth (and, on live routes, the database)
 * before validation on protected routes (`security` defaults to bearer; public routes pass
 * `security: []`), and the handler — or a 501 problem while the route is planned.
 */
export function defineRoute(app: OpenAPIHono<AppEnv>, spec: RouteSpec, handler?: Handler): void {
  const { status, ...config } = spec;
  const security = config.security ?? BEARER_AUTH;
  const isPublic = security.length === 0;
  const planned = status === 'planned';
  if (!planned && !handler) {
    throw new Error(`live route ${config.method.toUpperCase()} ${config.path} needs a handler`);
  }
  const route = createRoute({
    ...config,
    security,
    ...(planned ? { ...PLANNED, summary: `[planned] ${config.summary ?? ''}`.trim() } : {}),
    responses: planned
      ? { ...config.responses, ...NOT_IMPLEMENTED }
      : isPublic
        ? config.responses
        : { ...config.responses, ...UNAVAILABLE },
    // Live protected routes also need a verified user and the database (else 401 / 503).
    middleware: isPublic ? [] : planned ? [requireBearer] : [requireBearer, requireStore],
  });
  const run: Handler =
    handler ?? ((c) => problem(c, 'not-implemented', 'Planned route: see docs/decisions/api-sync-2026-10-20.md.'));
  // The 501 body isn't one of the success responses the route promises; the cast keeps the
  // declared contract while the handler is a placeholder (and lets live handlers stay untyped here).
  app.openapi(route, run as never);
}
