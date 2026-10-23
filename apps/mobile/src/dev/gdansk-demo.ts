/**
 * Dev-only: the Gdańsk demo account (demo@cityturfer.com). Its first sign-in
 * fills its own database with four months of walks, runs and rides along real
 * Gdańsk streets (routes from tools/gen-gdansk-routes.mjs) and picks Gdańsk as
 * Home City, so the app can be screenshotted without anyone's real location.
 * Everything goes through the normal use cases, so turf is claimed as usual. The plan and tracks
 * come from @cityturfer/core/demo, shared with the local API's demo account.
 */
import { DEMO_USER_ID, GDANSK_CITY_ID, planGdanskDemo, pointsOf } from '@cityturfer/core/demo';

import type { Container } from '@/composition-root';
import type { User } from '@/contexts/identity';

export { DEMO_USER_ID, trackAlongPath } from '@cityturfer/core/demo';

/** Ids from before the plan was resumable: `demo-gdansk-<start ms>` (depended on the day). */
const LEGACY_ID = /^demo-gdansk-\d+$/;

/** Every activity id in the profile (a few hundred at most on the demo account). */
async function activityIds(c: Container): Promise<string[]> {
  const ids: string[] = [];
  let before: number | undefined;
  for (;;) {
    const page = await c.activityLog.list.execute(200, before);
    if (page.length === 0) {
      return ids;
    }
    ids.push(...page.map((a) => a.id));
    before = page[page.length - 1].startedAt;
  }
}

/**
 * Import four months of Gdańsk activities and set Gdańsk as Home City. Resumable: an interrupted
 * seed picks up where it stopped (stable ids; the ones already there are skipped), on any day.
 * Returns how many activities it imported.
 */
export async function seedGdanskDemo(c: Container, onProgress?: (done: number, total: number) => void) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plan = planGdanskDemo(today.getTime());
  const existing = await activityIds(c);
  // A half-filled seed from before ids were stable: start over rather than duplicate it.
  const legacy = existing.filter((id) => LEGACY_ID.test(id));
  for (const id of legacy) {
    await c.activityLog.remove.execute(id);
  }
  const have = new Set(existing);
  const missing = plan.filter((p) => !have.has(p.id));
  if ((await c.territory.homeCity.execute())?.id !== GDANSK_CITY_ID) {
    await c.territory.chooseHomeCity.execute(GDANSK_CITY_ID);
  }
  let done = plan.length - missing.length;
  for (const p of missing) {
    const points = pointsOf(p);
    await c.activityLog.importActivity.execute({ id: p.id, type: p.route.type, points });
    onProgress?.(++done, plan.length);
  }
  await c.dispatcher.dispatchPending();
  return missing.length;
}

/**
 * Called after every sign-in: fills the demo account the first time it is used, and finishes a
 * fill that was interrupted (app killed during the first sign-in).
 */
export async function prepareDemoAccount(user: User, c: Container): Promise<void> {
  if (user.id !== DEMO_USER_ID) {
    return;
  }
  // The last planned activity is imported last: there, the fill finished.
  const plan = planGdanskDemo(0);
  if ((await c.activityLog.detail.execute(plan[plan.length - 1].id)) !== null) {
    return;
  }
  await seedGdanskDemo(c);
}
