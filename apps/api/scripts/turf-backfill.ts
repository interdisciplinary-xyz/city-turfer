// Claims the turf of activities uploaded before the server claimed turf (and deferred future
// starts once due): one activity per locked transaction, oldest first per user, idempotent and
// resumable — stop it any time and run it again. Safe while the API takes uploads.
//   DATABASE_URL_UNPOOLED=… pnpm --filter @cityturfer/api run turf:backfill -- --dry-run
//   DATABASE_URL_UNPOOLED=… pnpm --filter @cityturfer/api run turf:backfill -- [--user <userId>]
// Prints counts only: no user, activity or cell ids, no coordinates.
// Runbook: docs/operations/api-deploy.md ("Server turf: migrate, deploy, backfill").
import { H3CellGrid } from '@cityturfer/core/h3';

import { BackupService } from '../src/backup/use-cases';
import { DrizzleBackupStore } from '../src/db/store';
import { backfillTurf } from '../src/territory/backfill';
import { openDb } from './open-db';

const USAGE = 'Usage: pnpm --filter @cityturfer/api run turf:backfill -- [--user <userId>] [--dry-run]';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dryRun = args.includes('--dry-run');
const userAt = args.indexOf('--user');
const userId = userAt === -1 ? undefined : args[userAt + 1];
const known = args.filter((a, i) => a === '--dry-run' || a === '--user' || (userAt !== -1 && i === userAt + 1));
if (known.length !== args.length || (userAt !== -1 && (!userId || !/^[A-Za-z0-9_-]{1,64}$/.test(userId)))) {
  console.error(USAGE);
  process.exit(1);
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
          `user ${p.user}/${p.users}: ${p.claimed} claimed, ${p.deferred} deferred, ${p.failed} failed so far`
        ),
      onFailure: (error) => console.error(`a claim failed (${error}); that user is skipped until the next run`),
    },
    { userId, dryRun }
  );
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (dryRun) {
    console.log(`Dry run (${where}): ${report.pending} activities of ${report.users} users have no claim.`);
  } else {
    console.log(
      `Done (${where}, ${secs} s): ${report.claimed} claimed, ${report.deferred} deferred (start in the future), ${report.failed} failed; ${report.remaining} still unclaimed.`
    );
  }
  process.exitCode = report.failed > 0 ? 1 : 0;
} catch (error) {
  console.error(`Backfill failed: ${error instanceof Error ? error.name : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await close();
}
