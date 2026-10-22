import { createHash, timingSafeEqual } from 'node:crypto';

import type { OpenAPIHono } from '@hono/zod-openapi';

import type { AppEnv } from '../deps';
import { problem } from '../problem';

/** Vercel Cron calls this daily (apps/api/vercel.json `crons`); not part of the public contract. */
export const RETENTION_CRON_PATH = '/internal/cron/retention';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Constant time: both sides are hashed to 32 bytes first, so neither length nor content leaks. */
export function bearerMatches(header: string | undefined, secret: string): boolean {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return timingSafeEqual(digest(match?.[1] ?? ''), digest(secret)) && !!match;
}

/**
 * Internal routes: outside `/v1` and the OpenAPI spec (no client calls them). Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET (previews, local) the route is a 404;
 * production refuses to boot without it (`checkProductionEnv`).
 */
export function registerInternal(app: OpenAPIHono<AppEnv>): void {
  app.get(RETENTION_CRON_PATH, async (c) => {
    const { cronSecret, retention } = c.var.deps;
    if (!cronSecret) {
      return problem(c, 'not-found');
    }
    if (!bearerMatches(c.req.header('authorization'), cronSecret)) {
      return problem(c, 'auth.invalid', undefined, { headers: { 'WWW-Authenticate': 'Bearer' } });
    }
    if (!retention) {
      return problem(c, 'storage.unavailable', 'No database is configured.');
    }
    return c.json(await retention.purge(), 200);
  });
}
