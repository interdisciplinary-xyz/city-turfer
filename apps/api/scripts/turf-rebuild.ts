// Recomputes every Turf Cell from the claims that remain, per user, where they differ (one locked
// transaction per user); users with cells and no claims lose them all. Run it after any rollback
// to an API older than contract 0.6.0, before `turf:backfill`: while the old API ran, deletes,
// replaces and withdrawals cascaded claims away but left their cells. Idempotent, safe while the
// API takes uploads.
//   DATABASE_URL_UNPOOLED=… pnpm --filter @cityturfer/api run turf:rebuild -- --dry-run
//   DATABASE_URL_UNPOOLED=… pnpm --filter @cityturfer/api run turf:rebuild -- [--user <userId>]
// Prints counts only: no user, activity or cell ids, no coordinates.
// Runbook: docs/operations/api-deploy.md ("Server turf: migrate, deploy, backfill").
import { H3CellGrid } from '@cityturfer/core/h3';

import { BackupService } from '../src/backup/use-cases';
import { DrizzleBackupStore } from '../src/db/store';
import { rebuildTurf } from '../src/territory/rebuild';
import { openDb } from './open-db';

const USAGE = 'Usage: pnpm --filter @cityturfer/api run turf:rebuild -- [--user <userId>] [--dry-run]';

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
  const report = await rebuildTurf(
    {
      store,
      backup: new BackupService(store, { now: () => Date.now() }, grid),
      onProgress: (p) => {
        if (p.user % 100 === 0 || p.user === p.users) {
          console.log(`user ${p.user}/${p.users}: ${p.stale} stale so far (${p.drift} cell rows)`);
        }
      },
      onFailure: (error) => console.error(`a rebuild failed (${error}); run again`),
    },
    { userId, dryRun }
  );
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `${dryRun ? 'Dry run' : 'Done'} (${where}, ${secs} s): ${report.users} users with turf, ${report.stale} ${dryRun ? 'would be rebuilt' : 'rebuilt'} (${report.drift} cell rows differed), ${report.gone} erased meanwhile, ${report.failed} failed.`
  );
  process.exitCode = report.failed > 0 ? 1 : 0;
} catch (error) {
  console.error(`Rebuild failed: ${error instanceof Error ? error.name : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await close();
}
