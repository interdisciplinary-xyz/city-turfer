import type { OpenAPIHono } from '@hono/zod-openapi';

import { BackupService } from '../backup/use-cases';
import type { ApiDeps, AppEnv } from '../deps';
import { problem } from '../problem';
import { secretMatches } from '../secret';
import { type BackfillReport, backfillTurf } from '../territory/backfill';

/** Vercel Cron calls this daily (apps/api/vercel.json `crons`); not part of the public contract. */
export const RETENTION_CRON_PATH = '/internal/cron/retention';

/**
 * The daily turf catch-up's bounds: claim attempts and wall time per run. Deferred future starts
 * and stragglers are few; the bulk backfill is `pnpm --filter @cityturfer/api run turf:backfill`.
 */
export const TURF_CATCH_UP_ACTIVITIES = 25;
export const TURF_CATCH_UP_MS = 60_000;

/** Whether `Authorization` is `Bearer <secret>` (constant time, `secretMatches`). */
export function bearerMatches(header: string | undefined, secret: string): boolean {
  const match = /^\s*Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return secretMatches(match?.[1], secret);
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
    const purged = await retention.purge();
    return c.json({ ...purged, turf: await catchUpTurf(c.var.deps) }, 200);
  });
}

type CatchUp = Pick<BackfillReport, 'claimed' | 'deferred' | 'skipped' | 'failed' | 'remaining'>;

/**
 * Claims the turf of a few activities without a claim (deferred future starts once due, anything
 * the backfill missed), bounded by TURF_CATCH_UP_ACTIVITIES and TURF_CATCH_UP_MS. Never fails the
 * retention run: an error logs its class and answers null. Counts only, in the answer and the log.
 */
async function catchUpTurf(deps: ApiDeps): Promise<CatchUp | null> {
  const { store, grid, clock, log } = deps;
  if (!store || !grid) {
    return null;
  }
  try {
    const report = await backfillTurf(
      {
        store,
        backup: new BackupService(store, clock, grid),
        onFailure: (error) => log.event?.({ msg: 'turf.catch-up-failed', error }),
      },
      { maxActivities: TURF_CATCH_UP_ACTIVITIES, deadlineAt: Date.now() + TURF_CATCH_UP_MS }
    );
    const { claimed, deferred, skipped, failed, remaining } = report;
    log.event?.({ msg: 'turf.caught-up', claimed, deferred, skipped, failed, remaining, stopped: report.stopped });
    return { claimed, deferred, skipped, failed, remaining };
  } catch (e) {
    log.event?.({ msg: 'turf.catch-up-failed', error: e instanceof Error ? e.name : 'unknown' });
    return null;
  }
}
