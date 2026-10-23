// Claims the turf of activities uploaded before the server claimed turf (and deferred future
// starts once due): one activity per locked transaction, oldest first per user, idempotent and
// resumable — stop it any time and run it again. Safe while the API takes uploads.
//   DATABASE_URL_UNPOOLED=… pnpm --filter @cityturfer/api run turf:backfill -- --dry-run
//   DATABASE_URL_UNPOOLED=… pnpm --filter @cityturfer/api run turf:backfill -- [--user <userId>]
//     [--max <activities, default 20000>] [--minutes <wall time, default 30>]
// Stops at the budget or the deadline (run again to continue). Activities without a track cannot
// be claimed: reported as skipped, never attempted.
// Prints counts only: no user, activity or cell ids, no coordinates.
// Runbook: docs/operations/api-deploy.md ("Server turf: migrate, deploy, backfill").
import { H3CellGrid } from '@cityturfer/core/h3';

import { BackupService } from '../src/backup/use-cases';
import { DrizzleBackupStore } from '../src/db/store';
import { backfillTurf } from '../src/territory/backfill';
import { openDb } from './open-db';

const USAGE =
  'Usage: pnpm --filter @cityturfer/api run turf:backfill -- [--user <userId>] [--dry-run] [--max <n>] [--minutes <n>]';

/** Default bounds of one run: a stuck or huge run ends; the next run continues where it stopped. */
const DEFAULT_MAX_ACTIVITIES = 20_000;
const DEFAULT_MINUTES = 30;

const fail = (): never => {
  console.error(USAGE);
  process.exit(1);
};
const args = process.argv.slice(2).filter((a) => a !== '--');
let dryRun = false;
let userId: string | undefined;
let maxActivities = DEFAULT_MAX_ACTIVITIES;
let minutes = DEFAULT_MINUTES;
const positive = (v: string | undefined) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : fail();
};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dry-run') {
    dryRun = true;
  } else if (a === '--user') {
    userId = args[++i];
    if (!userId || !/^[A-Za-z0-9_-]{1,64}$/.test(userId)) {
      fail();
    }
  } else if (a === '--max') {
    maxActivities = positive(args[++i]);
  } else if (a === '--minutes') {
    minutes = positive(args[++i]);
  } else {
    fail();
  }
}

const { db, close, where } = await openDb();
const grid = new H3CellGrid();
const store = new DrizzleBackupStore(db, grid);
try {
  const started = Date.now();
  const report = await backfillTurf(
    {
      store,
      backup: new BackupService(store, { now: () => Date.now() }, grid),
      onProgress: (p) =>
        console.log(
          `user ${p.user}/${p.users}: ${p.claimed} claimed, ${p.deferred} deferred, ${p.skipped} skipped, ${p.failed} failed so far`
        ),
      onFailure: (error) => console.error(`a claim failed (${error}); that user is skipped until the next run`),
    },
    { userId, dryRun, maxActivities, deadlineAt: started + minutes * 60_000 }
  );
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (dryRun) {
    console.log(
      `Dry run (${where}): ${report.pending} activities of ${report.users} users have no claim; ${report.skipped} more have no track (cannot be claimed).`
    );
  } else {
    console.log(
      `${report.stopped === 'done' ? 'Done' : `Stopped (${report.stopped}; run again to continue)`} (${where}, ${secs} s): ${report.claimed} claimed, ${report.deferred} deferred (start in the future), ${report.skipped} skipped (no track), ${report.failed} failed; ${report.remaining} still unclaimed.`
    );
  }
  process.exitCode = report.failed > 0 ? 1 : 0;
} catch (error) {
  console.error(`Backfill failed: ${error instanceof Error ? error.name : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await close();
}
