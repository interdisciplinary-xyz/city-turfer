import type {
  ActivityDeleted,
  ActivityDistanceEstimated,
  ActivityRecorded,
  ActivityRenamed,
  ActivityTrackCorrected,
} from '@/contexts/activity-log';
import type { HomeCityChosen } from '@/contexts/territory';

import { mayUpload } from '../domain/backup-policy';
import type { CloudBackupDeps } from './ports';

/**
 * Outbox handlers. They only write to Cloud Backup's own tables — never the network — so they are
 * safe in the headless background task and can never hold up the outbox queue (which is strict FIFO:
 * a handler waiting on the network would delay Territory's claims). RunBackup sends the queued work
 * in the foreground. Idempotent: replaying an event leaves the same queued work. Nothing is queued
 * while backup is off (turning it on compares the whole history with the server instead).
 */
export class QueueBackupChanges {
  constructor(private readonly d: Pick<CloudBackupDeps, 'repo' | 'available'>) {}

  async activityRecorded(e: ActivityRecorded): Promise<void> {
    if (e.origin === 'restore') {
      return; // brought back from this backup: already on the server (Restore wrote its state first)
    }
    if (await this.eligible(e.activityId)) {
      await this.d.repo.updateBackup(e.activityId, e.startedAt, (b) => b.queueUpload());
    }
  }

  async trackCorrected(e: ActivityTrackCorrected): Promise<void> {
    if (await this.eligible(e.activityId)) {
      await this.d.repo.updateBackup(e.activityId, e.startedAt, (b) => b.queueCorrection());
    }
  }

  /** A rename goes up for Activities the backup already tracks (an upload carries the name anyway). */
  async activityRenamed(e: ActivityRenamed): Promise<void> {
    const b = (await this.eligible(e.activityId)) ? await this.d.repo.backupOf(e.activityId) : null;
    if (b) {
      await this.d.repo.updateBackup(e.activityId, b.toState().startedAt, (x) => x.queueRename());
    }
  }

  /** Gap routes go up only for Activities the backup already tracks (an upload sends them anyway). */
  async gapRoutesEstimated(e: ActivityDistanceEstimated): Promise<void> {
    const b = (await this.eligible(e.activityId)) ? await this.d.repo.backupOf(e.activityId) : null;
    if (b) {
      await this.d.repo.updateBackup(e.activityId, b.toState().startedAt, (x) => x.queueGapRoutes());
    }
  }

  /** Deletes go up for anything the backup tracks, Apple Health imports included (even if since excluded). */
  async activityDeleted(e: ActivityDeleted): Promise<void> {
    if (this.d.available) {
      await this.d.repo.rememberDeletedHere(e.activityId); // whatever the settings: restore must not undo it
    }
    if (!this.d.available || !(await this.d.repo.settings()).acceptsChanges) {
      return;
    }
    const b = await this.d.repo.backupOf(e.activityId);
    if (b) {
      await this.d.repo.updateBackup(e.activityId, b.toState().startedAt, (x) => x.queueDelete());
    }
  }

  async homeCityChosen(e: HomeCityChosen): Promise<void> {
    if (this.d.available) {
      await this.d.repo.updateSettings((s) => s.queueHomeCity(e.chosenAt ?? e.at));
    }
  }

  private async eligible(activityId: string): Promise<boolean> {
    if (!this.d.available) {
      return false;
    }
    const s = await this.d.repo.settings();
    return s.acceptsChanges && mayUpload(activityId, s.healthIncluded);
  }
}
