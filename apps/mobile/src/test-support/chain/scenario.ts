/**
 * Scenario helpers for the sync chain: put activities on a phone the way the app does, take a
 * snapshot of what the phone holds, and note checks that cannot run yet ("pending", never "pass").
 */
import { appendFileSync } from 'node:fs';

import type { ActivityType, TrackPoint } from '@/shared-kernel';
import { loadFixes } from '@/test-support/fixtures';

import type { ChainPhone, Pending } from './chain-server';

type Container = ChainPhone['c'];

const points = (gpx: string): TrackPoint[] =>
  loadFixes(gpx).map((f) => ({ ...f, segment: 0, accuracy: 5, speed: null }));

/** An activity with a chosen id (an import, like Apple Health or the demo history). */
export async function addActivity(c: Container, id: string, type: ActivityType, gpx: string): Promise<void> {
  await c.activityLog.importActivity.execute({ id, type, points: points(gpx) });
  await c.dispatcher.dispatchPending();
}

/** Everything a server-side action must never change on the phone. */
export async function phoneSnapshot(c: Container) {
  const list = await c.activityLog.list.execute(1000);
  const details = await Promise.all(list.map((x) => c.activityLog.detail.execute(x.id)));
  return {
    activities: details
      .map((d) => ({
        id: d!.id,
        type: d!.type,
        name: d!.name,
        distanceM: d!.distanceM,
        movingS: d!.movingS,
        points: d!.track.length,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    cells: (await c.territory.summary.execute()).cellCount,
    homeCity: (await c.territory.homeCityChoice.execute())?.cityId ?? null,
  };
}

/**
 * Notes a check that could not run. Written to CHAIN_REPORT (one JSON line each) when the chain
 * runner sets it; the runner lists them apart from the passes.
 */
export function notYet(server: string, check: string, p: Pending): void {
  const file = process.env.CHAIN_REPORT;
  if (file) {
    appendFileSync(file, `${JSON.stringify({ server, check, pending: p.pending })}\n`);
  }
}
