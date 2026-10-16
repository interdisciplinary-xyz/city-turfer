import { MAX_FIX_GAP_MS } from '@/constants/tracking';
import { type ActivityType, DomainError, type TrackPoint } from '@/shared-kernel';

import type { RecordingEvent } from './events';
import type { Fix } from './fix';
import { judgeFix, type Tail } from './fix-filter';
import { type TrackingProfile, trackingProfileFor } from './tracking-profile';

export type SessionStatus = 'recording' | 'paused' | 'autoPaused' | 'finished' | 'discarded';
export const ACTIVE_STATUSES: readonly SessionStatus[] = ['recording', 'paused', 'autoPaused'];

export interface RecordingSessionState {
  readonly id: string;
  readonly type: ActivityType;
  readonly status: SessionStatus;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly segment: number;
  readonly nextSeq: number;
  readonly tail: Tail | null; // last accepted point in the current segment
  readonly lastSeenT: number | null; // last fix timestamp seen (accepted or jitter)
  readonly slowSince: number | null; // auto-pause timer
  readonly pausedSince: number | null;
  readonly pausedMs: number;
  readonly distanceM: number;
  readonly movingS: number;
  readonly pointCount: number;
  readonly recent: readonly { t: number; d: number }[]; // (time, cumulative distance) for current pace
}

export interface LiveSnapshot {
  readonly sessionId: string;
  readonly type: ActivityType;
  readonly status: SessionStatus;
  readonly gps: 'acquiring' | 'ok';
  readonly distanceM: number;
  readonly activeS: number; // wall clock minus pauses
  readonly movingS: number;
  readonly currentSpeedMps: number | null;
  readonly pointCount: number;
  readonly computedAt: number; // the `now` this snapshot was computed for
}

const RECENT_WINDOW_MS = 30_000;

export type RejectReason = 'inaccurate' | 'out-of-order' | 'teleport';
export interface IngestReport {
  readonly points: TrackPoint[];
  readonly received: number;
  readonly rejected: Readonly<Record<RejectReason, number>>;
  readonly jitter: number;
  readonly ignoredWhilePaused: number;
  readonly gapSplits: number;
}

/**
 * Aggregate root of the Recording context. Holds state, tail and running
 * totals only — accepted Track Points are returned from `ingest` and appended
 * to the point log by the repository in the same transaction.
 */
export class RecordingSession {
  private events: RecordingEvent[] = [];
  private constructor(private state: RecordingSessionState) {}

  static start(id: string, type: ActivityType, now: number): RecordingSession {
    const s = new RecordingSession({
      id,
      type,
      status: 'recording',
      startedAt: now,
      endedAt: null,
      segment: 0,
      nextSeq: 0,
      tail: null,
      lastSeenT: null,
      slowSince: null,
      pausedSince: null,
      pausedMs: 0,
      distanceM: 0,
      movingS: 0,
      pointCount: 0,
      recent: [],
    });
    s.record({ type: 'SessionStarted', v: 1, at: now, sessionId: id, activityType: type });
    return s;
  }

  static rehydrate(state: RecordingSessionState): RecordingSession {
    return new RecordingSession(state);
  }

  get id() {
    return this.state.id;
  }
  get status() {
    return this.state.status;
  }
  get profile(): TrackingProfile {
    return trackingProfileFor(this.state.type);
  }
  get isActive() {
    return ACTIVE_STATUSES.includes(this.state.status);
  }
  toState(): RecordingSessionState {
    return this.state;
  }

  pause(now: number): void {
    this.assertActive();
    if (this.state.status === 'paused') throw new DomainError('session.already-paused');
    const pausedSince = this.state.pausedSince ?? now; // auto-paused → keep original start
    this.state = { ...this.state, status: 'paused', pausedSince, slowSince: null };
    this.record({ type: 'SessionPaused', v: 1, at: now, sessionId: this.id, auto: false });
  }

  resume(now: number): void {
    if (this.state.status !== 'paused') throw new DomainError('session.not-paused');
    this.endPause(now);
    // A manual resume starts a new segment: never measure or draw across the pause.
    this.state = { ...this.state, status: 'recording', segment: this.state.segment + 1, tail: null, recent: [] };
    this.record({
      type: 'SessionResumed',
      v: 1,
      at: now,
      sessionId: this.id,
      auto: false,
      segment: this.state.segment,
    });
  }

  /** Runs fixes through the Fix Filter and auto-pause; returns the accepted Track Points. */
  ingest(fixes: readonly Fix[]): TrackPoint[] {
    return this.ingestWithReport(fixes).points;
  }

  /** Like `ingest`, plus counts of what happened to every fix (diagnostics). */
  ingestWithReport(fixes: readonly Fix[]): IngestReport {
    const accepted: TrackPoint[] = [];
    const rejected: Record<RejectReason, number> = { inaccurate: 0, 'out-of-order': 0, teleport: 0 };
    let jitter = 0,
      ignoredWhilePaused = 0,
      gapSplits = 0;
    const profile = this.profile;
    for (const fix of [...fixes].sort((a, b) => a.t - b.t)) {
      const st = this.state.status;
      if (st !== 'recording' && st !== 'autoPaused') {
        ignoredWhilePaused++;
        continue;
      }
      // Fixes stopped arriving for a while (OS suspended us, tunnel, ...): start a new
      // segment rather than drawing a straight line through buildings.
      const tail = this.state.tail;
      if (tail && fix.t - tail.t > MAX_FIX_GAP_MS) {
        this.state = { ...this.state, segment: this.state.segment + 1, tail: null, recent: [], slowSince: null };
        gapSplits++;
      }
      const verdict = judgeFix(fix, this.state.tail, this.state.lastSeenT, profile);
      if (verdict.kind === 'reject') {
        rejected[verdict.reason]++;
        continue;
      }

      this.state = { ...this.state, lastSeenT: fix.t };
      this.applyAutoPause(fix.t, verdict.speedMps, profile);
      if (verdict.kind === 'jitter') {
        jitter++;
        continue;
      }
      if (this.state.status !== 'recording') continue;

      const s = this.state;
      const moving = verdict.dtS > 0 && verdict.speedMps >= profile.movingSpeedMps;
      const distanceM = s.distanceM + verdict.distanceM;
      const point: TrackPoint = {
        lat: fix.lat,
        lon: fix.lon,
        t: fix.t,
        segment: s.segment,
        alt: fix.alt,
        accuracy: fix.accuracy,
        speed: fix.speed,
      };
      accepted.push(point);
      this.state = {
        ...s,
        tail: { lat: fix.lat, lon: fix.lon, t: fix.t },
        nextSeq: s.nextSeq + 1,
        pointCount: s.pointCount + 1,
        distanceM,
        movingS: s.movingS + (moving ? verdict.dtS : 0),
        recent: [...s.recent.filter((r) => fix.t - r.t <= RECENT_WINDOW_MS), { t: fix.t, d: distanceM }],
      };
    }
    return { points: accepted, received: fixes.length, rejected, jitter, ignoredWhilePaused, gapSplits };
  }

  finish(now: number): void {
    this.assertActive();
    if (this.state.pointCount < 2) throw new DomainError('session.too-short');
    if (this.state.pausedSince != null) this.endPause(now);
    this.state = { ...this.state, status: 'finished', endedAt: now };
    this.record({
      type: 'SessionFinished',
      v: 1,
      at: now,
      sessionId: this.id,
      activityType: this.state.type,
      startedAt: this.state.startedAt,
      endedAt: now,
    });
  }

  discard(now: number): void {
    this.assertActive();
    this.state = { ...this.state, status: 'discarded', endedAt: now };
    this.record({ type: 'SessionDiscarded', v: 1, at: now, sessionId: this.id });
  }

  snapshot(now: number): LiveSnapshot {
    const s = this.state;
    const pausedNow = s.pausedSince != null ? now - s.pausedSince : 0;
    const first = s.recent[0];
    const last = s.recent[s.recent.length - 1];
    const span = first && last ? (last.t - first.t) / 1000 : 0;
    return {
      sessionId: s.id,
      type: s.type,
      status: s.status,
      gps: s.pointCount > 0 ? 'ok' : 'acquiring',
      distanceM: s.distanceM,
      activeS: Math.max(0, Math.round(((s.endedAt ?? now) - s.startedAt - s.pausedMs - pausedNow) / 1000)),
      movingS: Math.round(s.movingS),
      currentSpeedMps: s.status === 'recording' && span >= 5 ? (last.d - first.d) / span : null,
      pointCount: s.pointCount,
      computedAt: now,
    };
  }

  pullEvents(): RecordingEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** The sequence number the next accepted point will get (repository use). */
  firstSeqOf(acceptedCount: number): number {
    return this.state.nextSeq - acceptedCount;
  }

  private applyAutoPause(t: number, speed: number, profile: TrackingProfile) {
    const s = this.state;
    if (speed < profile.movingSpeedMps) {
      const slowSince = s.slowSince ?? t;
      this.state = { ...s, slowSince };
      if (s.status === 'recording' && t - slowSince >= profile.autoPauseAfterS * 1000) {
        this.state = { ...this.state, status: 'autoPaused', pausedSince: t, recent: [] };
        this.record({ type: 'SessionPaused', v: 1, at: t, sessionId: s.id, auto: true });
      }
    } else {
      this.state = { ...s, slowSince: null };
      if (s.status === 'autoPaused') {
        this.endPause(t);
        this.state = { ...this.state, status: 'recording' };
        this.record({ type: 'SessionResumed', v: 1, at: t, sessionId: s.id, auto: true, segment: s.segment });
      }
    }
  }

  private endPause(now: number) {
    const s = this.state;
    if (s.pausedSince == null) return;
    this.state = { ...s, pausedMs: s.pausedMs + Math.max(0, now - s.pausedSince), pausedSince: null };
  }

  private assertActive() {
    if (!this.isActive) throw new DomainError('session.not-active', this.state.status);
  }

  private record(e: RecordingEvent) {
    this.events.push(e);
  }
}
