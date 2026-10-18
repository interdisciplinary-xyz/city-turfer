import { type ActivityType, type Clock, DomainError, type IdGenerator, type TrackPoint } from '@/shared-kernel';

import type { Fix } from '../domain/fix';
import { type IngestReport, type LiveSnapshot, RecordingSession } from '../domain/recording-session';
import type { RecordingSessionRepository } from '../domain/recording-session-repository';
import type { SerialCommandExecutor } from './command-executor';
import type { LiveSessionNotifier, LocationTracker, PermissionGateway } from './ports';

export interface RecordingDeps {
  sessions: RecordingSessionRepository;
  tracker: LocationTracker;
  permissions: PermissionGateway;
  notifier: LiveSessionNotifier;
  clock: Clock;
  ids: IdGenerator;
  /** Called after a commit that produced events (dispatch the outbox). */
  afterCommit: () => void;
  /** One per container: every command below that changes a session runs through it. */
  commands: SerialCommandExecutor;
}

/** Ask for location access up front (e.g. to show the user's position before Start). */
export class PrepareRecording {
  constructor(private readonly d: RecordingDeps) {}
  execute() {
    return this.d.permissions.ensureForeground();
  }
}

export type StartResult =
  | { kind: 'started'; snapshot: LiveSnapshot }
  | { kind: 'already-active'; snapshot: LiveSnapshot }
  | { kind: 'permission-denied' }
  | { kind: 'location-services-off' };

export class StartRecording {
  constructor(private readonly d: RecordingDeps) {}
  async execute(type: ActivityType): Promise<StartResult> {
    const active = await this.d.sessions.getActive();
    if (active) return { kind: 'already-active', snapshot: active.snapshot(this.d.clock.now()) };

    // System dialogs stay outside the command queue: they can be open for a long time.
    const permission = await this.d.permissions.ensureForeground();
    if (permission === 'denied') return { kind: 'permission-denied' };
    if (permission === 'services-off') return { kind: 'location-services-off' };
    await this.d.permissions.requestBackground();

    return this.d.commands.run(async (): Promise<StartResult> => {
      const now = this.d.clock.now();
      const raced = await this.d.sessions.getActive(); // e.g. a double tap on Start
      if (raced) return { kind: 'already-active', snapshot: raced.snapshot(now) };
      const session = RecordingSession.start(this.d.ids.next(), type, now);
      await this.d.sessions.save(session, []);
      try {
        await this.d.tracker.start(session.profile);
      } catch (e) {
        session.discard(this.d.clock.now());
        await this.d.sessions.save(session, []);
        throw e;
      }
      const snapshot = session.snapshot(now);
      this.d.notifier.publish(snapshot);
      return { kind: 'started', snapshot };
    });
  }
}

export class PauseRecording {
  constructor(private readonly d: RecordingDeps) {}
  execute(): Promise<LiveSnapshot | null> {
    return this.d.commands.run(() => this.run());
  }
  private async run(): Promise<LiveSnapshot | null> {
    const session = await this.d.sessions.getActive();
    if (!session) return null;
    session.pause(this.d.clock.now());
    await this.d.sessions.save(session, []);
    const snap = session.snapshot(this.d.clock.now());
    this.d.notifier.publish(snap);
    return snap;
  }
}

export class ResumeRecording {
  constructor(private readonly d: RecordingDeps) {}
  execute(): Promise<LiveSnapshot | null> {
    return this.d.commands.run(() => this.run());
  }
  private async run(): Promise<LiveSnapshot | null> {
    const session = await this.d.sessions.getActive();
    if (!session) return null;
    session.resume(this.d.clock.now());
    await this.d.sessions.save(session, []);
    if (!(await this.d.tracker.isRunning())) await this.d.tracker.start(session.profile);
    const snap = session.snapshot(this.d.clock.now());
    this.d.notifier.publish(snap);
    return snap;
  }
}

export type IngestResult =
  | { kind: 'no-active-session' }
  | {
      kind: 'ingested';
      accepted: number;
      report: Omit<IngestReport, 'points'>;
      status: string;
      snapshot: LiveSnapshot;
      /** See LocationTracker.reacquire (diagnostics). */
      keptAlive: boolean | null;
    };

/**
 * Driven by the background location task. Never throws for expected outcomes.
 * With no active session the tracker is an orphan (e.g. a batch delivered after
 * Finish): stop it here, inside the queue, so it can't race a new Start.
 */
export class IngestFixes {
  constructor(private readonly d: RecordingDeps) {}
  execute(fixes: readonly Fix[]): Promise<IngestResult> {
    return this.d.commands.run(() => this.run(fixes));
  }
  private async run(fixes: readonly Fix[]): Promise<IngestResult> {
    const session = await this.d.sessions.getActive();
    if (!session) {
      await this.d.tracker.stop();
      return { kind: 'no-active-session' };
    }
    const { points, ...report } = session.ingestWithReport(fixes);
    await this.d.sessions.save(session, points);
    // Inside the queue, so a Finish/Discard queued behind us can't be undone by it.
    const keptAlive = await this.d.tracker.reacquire().catch(() => null);
    const snapshot = session.snapshot(this.d.clock.now());
    this.d.notifier.publish(snapshot);
    return { kind: 'ingested', accepted: points.length, report, status: session.status, snapshot, keptAlive };
  }
}

export type FinishResult =
  { kind: 'finished'; sessionId: string } | { kind: 'too-short' } | { kind: 'no-active-session' };

export class FinishRecording {
  constructor(private readonly d: RecordingDeps) {}
  execute(): Promise<FinishResult> {
    return this.d.commands.run(() => this.run());
  }
  private async run(): Promise<FinishResult> {
    const session = await this.d.sessions.getActive();
    if (!session) return { kind: 'no-active-session' };
    try {
      session.finish(this.d.clock.now());
    } catch (e) {
      if (e instanceof DomainError && e.code === 'session.too-short') return { kind: 'too-short' };
      throw e;
    }
    await this.d.sessions.save(session, []);
    await this.d.tracker.stop();
    this.d.notifier.publish(null);
    this.d.afterCommit();
    return { kind: 'finished', sessionId: session.id };
  }
}

export class DiscardRecording {
  constructor(private readonly d: RecordingDeps) {}
  execute(): Promise<void> {
    return this.d.commands.run(() => this.run());
  }
  private async run(): Promise<void> {
    const session = await this.d.sessions.getActive();
    if (session) {
      session.discard(this.d.clock.now());
      await this.d.sessions.save(session, []); // also deletes its track points, same transaction
    }
    await this.d.tracker.stop();
    this.d.notifier.publish(null);
  }
}

export type RecoveryResult =
  | { kind: 'nothing' }
  | { kind: 'resumed-tracking'; snapshot: LiveSnapshot } // session active, OS had stopped updates
  | { kind: 'tracking-continues'; snapshot: LiveSnapshot }
  | { kind: 'stopped-orphan-tracker' };

/** App start: reconcile the active session with the OS tracker state. */
export class RecoverSession {
  constructor(private readonly d: RecordingDeps) {}
  execute(): Promise<RecoveryResult> {
    return this.d.commands.run(() => this.run());
  }
  private async run(): Promise<RecoveryResult> {
    const session = await this.d.sessions.getActive();
    const running = await this.d.tracker.isRunning();
    if (!session) {
      if (running) {
        await this.d.tracker.stop();
        return { kind: 'stopped-orphan-tracker' };
      }
      return { kind: 'nothing' };
    }
    const snapshot = session.snapshot(this.d.clock.now());
    this.d.notifier.publish(snapshot);
    if (!running) {
      try {
        await this.d.tracker.start(session.profile);
        return { kind: 'resumed-tracking', snapshot };
      } catch {
        return { kind: 'tracking-continues', snapshot };
      }
    }
    return { kind: 'tracking-continues', snapshot };
  }
}

export class GetLiveSnapshot {
  constructor(private readonly d: RecordingDeps) {}
  async execute(): Promise<LiveSnapshot | null> {
    const session = await this.d.sessions.getActive();
    return session ? session.snapshot(this.d.clock.now()) : null;
  }
}

/** Points of the active session, for the live map. */
export class GetLiveTrack {
  constructor(private readonly d: RecordingDeps) {}
  async execute(): Promise<TrackPoint[]> {
    const session = await this.d.sessions.getActive();
    return session ? this.d.sessions.pointsOf(session.id) : [];
  }
}

/** Open-host service for Activity Log: the full track of a finished session. */
export class FinishedTrackQuery {
  constructor(private readonly d: Pick<RecordingDeps, 'sessions'>) {}
  async execute(sessionId: string): Promise<TrackPoint[] | null> {
    const session = await this.d.sessions.get(sessionId);
    if (!session || session.status !== 'finished') return null;
    return this.d.sessions.pointsOf(sessionId);
  }
}

/** Handles ActivityRecorded: the activity log owns the track now. */
export class PurgeRecordedSession {
  constructor(private readonly d: Pick<RecordingDeps, 'sessions'>) {}
  async execute(sessionId: string): Promise<void> {
    await this.d.sessions.purgePoints(sessionId);
  }
}
