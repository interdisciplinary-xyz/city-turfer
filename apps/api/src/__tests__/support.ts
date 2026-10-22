import { createHash } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { createApp } from '../app';
import { deviceTokenAuth, parseApiTokens } from '../auth/device-tokens';
import { DrizzleExportStore, PostgresFileStorage } from '../db/exports';
import { createPgliteDb } from '../db/pglite';
import { PostgresRateLimiter } from '../db/rate-limits';
import { DrizzleRetentionStore } from '../db/retention';
import { DrizzleBackupStore } from '../db/store';
import { type ApiLog, defaultDeps, silentLog } from '../deps';
import { createAuth } from '../identity/better-auth';
import { MemoryMailer } from '../identity/mailer';
import { compositeVerifier, IdentityService } from '../identity/use-cases';
import { RetentionService } from '../privacy/retention';
import { ExportService } from '../privacy/use-cases';

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

/** Made up for tests (≥ 32 characters); never a real secret. */
export const TEST_AUTH_SECRET = 'test-secret-test-secret-test-secret-0123';

/** Made up for tests; never a real secret. */
export const TEST_CRON_SECRET = 'test-cron-secret-0123456789';

/**
 * The app on an empty, migrated in-memory Postgres (PGlite), with a controllable clock, device
 * tokens and sign-in by e-mailed code (Better Auth; codes land in `mailer`).
 */
export async function backupApp(
  options: { fixedCode?: string; mailer?: MemoryMailer; log?: ApiLog; cronSecret?: string | null } = {}
) {
  shared ??= createPgliteDb();
  const { db } = await shared;
  await emptyTables(db);
  // The shared database outlives each test; `closeSharedDb()` closes it once per file.
  const close = async () => undefined;
  const store = new DrizzleBackupStore(db);
  const clock = { t: Date.parse('2026-10-20T08:00:00Z'), now: () => clock.t };
  const mailer = options.mailer ?? new MemoryMailer();
  const auth = createAuth({
    db,
    secret: TEST_AUTH_SECRET,
    baseURL: 'http://localhost:8787',
    mailer,
    fixedCode: options.fixedCode ?? null,
  });
  const identity = new IdentityService(auth, new PostgresRateLimiter(db), TEST_AUTH_SECRET, clock);
  const log = options.log ?? silentLog;
  const app = createApp(
    defaultDeps({
      auth: compositeVerifier(deviceTokenAuth(parseApiTokens(API_TOKENS).entries), identity.verifier),
      clock,
      log,
      store,
      identity,
      exports: new ExportService(
        store,
        new DrizzleExportStore(db),
        new PostgresFileStorage(db),
        mailer,
        clock,
        'http://localhost:8787',
        log
      ),
      retention: new RetentionService(new DrizzleRetentionStore(db), clock, log),
      cronSecret: options.cronSecret === undefined ? TEST_CRON_SECRET : options.cronSecret,
    })
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
  /** Asks for a code and signs in with it: the bearer token of `email`. */
  const signIn = async (email: string, ip = '203.0.113.7') => {
    await call('POST', '/v1/auth/codes', { token: null, body: { email }, headers: { 'X-Real-IP': ip } });
    const code = codeIn(mailer.lastTo(email)?.text);
    const res = await call('POST', '/v1/auth/sign-in', {
      token: null,
      body: { email, code },
      headers: { 'X-Real-IP': ip },
    });
    return ((await res.json()) as { token: string }).token;
  };
  return { app, store, db, clock, call, close, mailer, identity, signIn };
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

/** The 6-digit code in a sign-in e-mail. */
export function codeIn(text: string | undefined): string {
  const code = /\b(\d{6})\b/.exec(text ?? '')?.[1];
  if (!code) {
    throw new Error('no code in the mail');
  }
  return code;
}
