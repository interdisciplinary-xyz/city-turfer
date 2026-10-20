import { createHash } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { createApp } from '../app';
import { deviceTokenAuth, parseApiTokens } from '../auth/device-tokens';
import { createPgliteDb } from '../db/pglite';
import { DrizzleBackupStore } from '../db/store';
import { defaultDeps, silentLog } from '../deps';

/** Device tokens of the test users (made up; never real secrets). */
export const TOKENS = { admin: 'test-token-admin', other: 'test-token-other' } as const;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const API_TOKENS = JSON.stringify({
  [sha256(TOKENS.admin)]: { userId: 'admin', email: 'admin@cityturfer.com', displayName: 'Admin' },
  [sha256(TOKENS.other)]: 'other',
});

/**
 * One migrated in-memory Postgres (PGlite) per test file: starting PGlite takes seconds (over 10 s
 * on CI runners), emptying its tables takes milliseconds. Vitest isolates modules per file, so
 * files never share it. Close it with `closeSharedDb()` in the file's `afterAll`.
 */
let shared: ReturnType<typeof createPgliteDb> | null = null;

export async function closeSharedDb(): Promise<void> {
  if (shared) {
    const { close } = await shared;
    shared = null;
    await close();
  }
}

/** Empties every table of the public schema and restarts its sequences (the change feed's too). */
async function emptyTables(db: Awaited<ReturnType<typeof createPgliteDb>>['db']): Promise<void> {
  const result = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const rows = (result as unknown as { rows: { tablename: string }[] }).rows;
  if (rows.length > 0) {
    const list = rows.map((r) => `"${r.tablename}"`).join(', ');
    await db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`));
  }
}

/** The app on an empty, migrated in-memory Postgres (PGlite), with a controllable clock. */
export async function backupApp() {
  shared ??= createPgliteDb();
  const { db } = await shared;
  await emptyTables(db);
  // The shared database outlives each test; `closeSharedDb()` closes it once per file.
  const close = async () => undefined;
  const store = new DrizzleBackupStore(db);
  const clock = { t: Date.parse('2026-10-20T08:00:00Z'), now: () => clock.t };
  const app = createApp(
    defaultDeps({ auth: deviceTokenAuth(parseApiTokens(API_TOKENS).entries), clock, log: silentLog, store })
  );
  const call = (
    method: string,
    path: string,
    opts: { token?: string | null; body?: unknown; headers?: Record<string, string>; raw?: BodyInit } = {}
  ) => {
    const headers: Record<string, string> = { ...opts.headers };
    const token = opts.token === undefined ? TOKENS.admin : opts.token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    let body: BodyInit | undefined = opts.raw;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    return app.request(path, { method, headers, body });
  };
  return { app, store, db, clock, call, close };
}

/** A made-up run around Warsaw Old Town (public landmark): `n` points, 3 s and ~7 m apart. */
export function track(n = 40, start = Date.parse('2026-10-19T07:12:00Z')): [number, number, number, number, number][] {
  return Array.from({ length: n }, (_, i) => [
    Number((21.0122 + i * 1e-4).toFixed(6)),
    52.2297,
    start + i * 3000,
    0,
    98.5,
  ]);
}

export function upload(overrides: Record<string, unknown> = {}) {
  const points = track();
  return {
    type: 'run',
    name: 'Morning run',
    source: 'recording',
    startedAt: new Date(points[0][2]).toISOString(),
    endedAt: new Date(points.at(-1)![2]).toISOString(),
    timeZone: 'Europe/Warsaw',
    resumedSegments: null,
    track: { points },
    ...overrides,
  };
}
