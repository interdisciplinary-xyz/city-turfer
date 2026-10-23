/**
 * Scenario helpers for the sync chain: put activities on a phone the way the app does, take a
 * snapshot of what the phone holds, and note checks that cannot run yet ("pending", never "pass").
 */
import { appendFileSync } from 'node:fs';

import type { ActivityType, TrackPoint } from '@/shared-kernel';
import { loadFixes } from '@/test-support/fixtures';

import type { ChainPhone } from './chain-server';
import type { Pending } from './pending';

type Container = ChainPhone['c'];

const points = (gpx: string): TrackPoint[] =>
  loadFixes(gpx).map((f) => ({ ...f, segment: 0, accuracy: 5, speed: null }));

/** An activity with a chosen id (an import, like Apple Health or the demo history). */
export async function addActivity(c: Container, id: string, type: ActivityType, gpx: string): Promise<void> {
  await c.activityLog.importActivity.execute({ id, type, points: points(gpx) });
  await c.dispatcher.dispatchPending();
}

/**
 * Turns backup on and runs it until nothing is in flight. The app may already be running one in the
 * background (the outbox starts runs), so callers check the outcome on the server and in the
 * backup status, not in this run's report.
 */
export async function turnBackupOn(c: Container): Promise<void> {
  const on = await c.cloudBackup.enable.execute();
  if (on.kind !== 'ok') {
    throw new Error(`backup did not turn on: ${JSON.stringify(on)}`);
  }
  await settleBackup(c);
}

/** One backup run now, after and before waiting for any run already going. */
export async function settleBackup(c: Container) {
  await c.cloudBackup.run.whenIdle();
  const r = await c.cloudBackup.run.execute({ now: true });
  await c.cloudBackup.run.whenIdle();
  return r;
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
 * runner sets it, and the runner lists them apart from the passes; printed to stderr otherwise.
 */
export function notYet(server: string, check: string, p: Pending): void {
  const file = process.env.CHAIN_REPORT;
  if (file) {
    appendFileSync(file, `${JSON.stringify({ server, check, pending: p.pending })}\n`);
  } else {
    // Outside the runner nothing lists pending checks, and the test itself shows green: say so.
    process.stderr.write(`PENDING, NOT RUN [${server}] ${check}: ${p.pending}\n`);
  }
}
