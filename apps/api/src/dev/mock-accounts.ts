// Local dev server only (src/server.ts, PGlite): the app's mock accounts on the API, so the web
// portal can be signed in to with mock data. Never wired into the Vercel entry (src/index.ts).
//
// - admin@cityturfer.com → user `admin` (the `dev-token` user), demo@cityturfer.com → user `demo`;
//   both sign in with the code MOCK_CODE (AUTH_FIXED_CODE, refused in production).
// - The demo account gets the phone's Gdańsk demo history (@cityturfer/core/demo, same ids), uploaded
//   through the API's own routes like a phone backup, so everything derived from it (summaries, and
//   turf once the server projects it) is built the normal way.
import { DEMO_USER_ID, planGdanskDemo, pointsOf } from '@cityturfer/core/demo';

import type { Db } from '../db/store';
import { adopt, type AdoptResult } from '../identity/adopt';

export const MOCK_CODE = '000000';

export const MOCK_ACCOUNTS = [
  { userId: 'admin', email: 'admin@cityturfer.com' },
  { userId: DEMO_USER_ID, email: 'demo@cityturfer.com' },
] as const;

export const MOCK_EMAILS: readonly string[] = MOCK_ACCOUNTS.map((a) => a.email);

/** The consent policy version the seed records (as the phone would). */
const POLICY_VERSION = 'dev-mock';
const TIME_ZONE = 'Europe/Warsaw';

/** Links each mock e-mail to its user id; returns one note per account that could not be linked. */
export async function adoptMockAccounts(db: Db): Promise<string[]> {
  const notes: string[] = [];
  for (const { userId, email } of MOCK_ACCOUNTS) {
    const result: AdoptResult = await adopt(db, userId, email);
    if (result === 'email-taken' || result === 'user-has-other-email') {
      notes.push(`${email} is linked to another local account (reset with: rm -rf apps/api/.data)`);
    }
  }
  return notes;
}

type Fetch = (request: Request) => Response | Promise<Response>;

/** Midnight today, local time: the demo plan ends yesterday. */
function startOfToday(now = new Date()): number {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * Uploads the demo history to the `demo` user through `fetch` (the app itself, in process) with a
 * bearer `token` for that user. Skips everything when the newest planned activity is already
 * there (a finished seed); otherwise turns on backup and uploads the plan, oldest first (an upload
 * that is already there is a replay or a replace, never a duplicate). Logs counts only.
 */
export async function seedDemoBackup(
  fetch: Fetch,
  token: string,
  {
    today = startOfToday(),
    origin = 'http://localhost',
    limit,
  }: { today?: number; origin?: string; /** Only the oldest `limit` activities (tests). */ limit?: number } = {}
): Promise<{ uploaded: number; total: number }> {
  const plan = planGdanskDemo(today).slice(0, limit);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const call = (method: string, path: string, body?: unknown) =>
    fetch(
      new Request(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    );

  const newest = plan[plan.length - 1];
  if (newest && (await call('GET', `/v1/activities/${newest.id}`)).status === 200) {
    return { uploaded: 0, total: plan.length };
  }
  const consent = await call('PUT', '/v1/me/consents/cloud-sync', { granted: true, policyVersion: POLICY_VERSION });
  if (!consent.ok) {
    throw new Error(`consent answered ${consent.status}`);
  }
  let uploaded = 0;
  for (const p of plan) {
    const points = pointsOf(p);
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) {
      continue;
    }
    const answer = await call('PUT', `/v1/activities/${p.id}`, {
      type: p.route.type,
      name: p.route.name,
      source: 'import',
      startedAt: new Date(first.t).toISOString(),
      endedAt: new Date(last.t).toISOString(),
      timeZone: TIME_ZONE,
      resumedSegments: null,
      track: { points: points.map((q) => [q.lon, q.lat, q.t, q.segment, q.alt]) },
    });
    if (!answer.ok) {
      throw new Error(`upload ${uploaded + 1}/${plan.length} answered ${answer.status}`);
    }
    uploaded++;
  }
  return { uploaded, total: plan.length };
}
