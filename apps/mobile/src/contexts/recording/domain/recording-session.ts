import { MAX_FIX_GAP_MS } from '@/constants/tracking';
import { type ActivityType, distanceM, DomainError, type TrackPoint } from '@/shared-kernel';

import type { RecordingEvent } from './events';
import type { Fix } from './fix';
import { judgeFix, type Tail } from './fix-filter';
import { type TrackingProfile, trackingProfileFor } from './tracking-profile';

export type SessionStatus = 'recording' | 'paused' | 'autoPaused' | 'finished' | 'discarded';
export const ACTIVE_STATUSES: readonly SessionStatus[] = ['recording', 'paused', 'autoPaused'];
/** A session that has ended stays ended: it is never recorded into or revived again. */
export const TERMINAL_STATUSES: readonly SessionStatus[] = ['finished', 'discarded'];

export interface RecordingSessionState {
  readonly id: string;
  readonly type: ActivityType;
  readonly status: SessionStatus;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly segment: number;
  /**
   * Segments that begin with a manual Resume (every other segment after the first begins after a
   * GPS gap). Absent in state persisted by builds before this was tracked: reason unknown.
   */
  readonly resumedSegments?: readonly number[];
  readonly nextSeq: number;
  readonly tail: Tail | null; // last accepted point in the current segment
  readonly lastSeenT: number | null; // last fix timestamp seen (accepted or jitter)
  // Last fix seen (accepted or jitter), with position. Absent in states saved before v0.2.0.
  readonly lastSeen?: Tail | null;
  // While auto-paused: the reference the resume speed is measured from. It follows accepted
  // (non-jitter) fixes so a long stop does not dilute the implied speed of the first steps.
  readonly pauseAnchor?: Tail | null;
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
/** A closed session keeps no position (location is personal data): every field that holds one. */
const NO_POSITION = { tail: null, recent: [], lastSeen: null, pauseAnchor: null } as const;

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
      resumedSegments: [],
      nextSeq: 0,
      tail: null,
      lastSeenT: null,
      lastSeen: null,
      pauseAnchor: null,
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

  /**
   * Persistence guard: this copy may replace the stored session only while the
   * stored one has not ended. A stale copy (loaded before a Finish/Discard
   * committed) would otherwise turn a finished session back into a recording one.
   */
  assertMayReplace(persisted: SessionStatus): void {
    if (TERMINAL_STATUSES.includes(persisted)) {
      throw new DomainError('session.already-ended', `${persisted} -> ${this.state.status}`);
    }
  }

  pause(now: number): void {
    this.assertActive();
    if (this.state.status === 'paused') {
      throw new DomainError('session.already-paused');
    }
    const pausedSince = this.state.pausedSince ?? now; // auto-paused → keep original start
    this.state = { ...this.state, status: 'paused', pausedSince, slowSince: null, pauseAnchor: null };
    this.record({ type: 'SessionPaused', v: 1, at: now, sessionId: this.id, auto: false });
  }

  resume(now: number): void {
    if (this.state.status !== 'paused') {
      throw new DomainError('session.not-paused');
    }
    this.endPause(now);
    // A manual resume starts a new segment: never measure or draw across the pause.
    const segment = this.state.segment + 1;
    const resumedSegments = this.state.resumedSegments && [...this.state.resumedSegments, segment];
    this.state = {
      ...this.state,
      status: 'recording',
      segment,
      resumedSegments,
      tail: null,
      pauseAnchor: null,
      recent: [],
    };
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
      // segment rather than drawing a straight line through buildings. Measured from the
      // last fix *seen*, not the tail: while auto-paused the tail stays at the stop point
      // although jitter fixes keep arriving, and a long stop is not an outage.
      const lastSeenT = this.state.lastSeenT;
      if (this.state.tail && lastSeenT != null && fix.t - lastSeenT > MAX_FIX_GAP_MS) {
        this.state = {
          ...this.state,
          segment: this.state.segment + 1,
          tail: null,
          pauseAnchor: null,
          recent: [],
          slowSince: null,
        };
        gapSplits++;
      }
      const wasAutoPaused = st === 'autoPaused';
      const reference = wasAutoPaused ? (this.state.pauseAnchor ?? this.state.tail) : this.state.tail;
      const verdict = judgeFix(fix, reference, lastSeenT, profile, this.state.lastSeen ?? null);
      if (verdict.kind === 'reject') {
        rejected[verdict.reason]++;
        continue;
      }

      const seen = { lat: fix.lat, lon: fix.lon, t: fix.t };
      this.state = {
        ...this.state,
        lastSeenT: fix.t,
        lastSeen: seen,
        pauseAnchor: wasAutoPaused && verdict.kind === 'accept' ? seen : (this.state.pauseAnchor ?? null),
      };
      this.applyAutoPause(fix.t, verdict.speedMps, profile);
      if (this.state.status !== 'recording') {
        if (verdict.kind === 'jitter') {
          jitter++;
        }
        continue;
      }
      const s = this.state;
      let step: { m: number; dtS: number; moving: boolean };
      if (wasAutoPaused) {
        // This fix just ended an auto-pause and is always recorded (even a jitter verdict
        // with fresh Doppler speed), so the next fix is not measured from a stale tail.
        // The verdict was measured from the pause anchor; the track continues from the last
        // recorded point, so measure from there (drawn line == counted distance). Moving
        // time covers only the interval since the previous fix, never the stop itself.
        step = {
          m: s.tail ? distanceM(s.tail, fix) : 0,
          dtS: lastSeenT != null ? (fix.t - lastSeenT) / 1000 : 0,
          moving: s.tail != null,
        };
      } else if (verdict.kind === 'accept') {
        step = {
          m: verdict.distanceM,
          dtS: verdict.dtS,
          moving: verdict.dtS > 0 && verdict.speedMps >= profile.movingSpeedMps,
        };
      } else {
        jitter++;
        continue;
      }
      const distanceTotal = s.distanceM + step.m;
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
        tail: seen,
        pauseAnchor: null,
        nextSeq: s.nextSeq + 1,
        pointCount: s.pointCount + 1,
        distanceM: distanceTotal,
        movingS: s.movingS + (step.moving ? step.dtS : 0),
        recent: [...s.recent.filter((r) => fix.t - r.t <= RECENT_WINDOW_MS), { t: fix.t, d: distanceTotal }],
      };
    }
    return { points: accepted, received: fixes.length, rejected, jitter, ignoredWhilePaused, gapSplits };
  }

  finish(now: number): void {
    this.assertActive();
    if (this.state.pointCount < 2) {
      throw new DomainError('session.too-short');
    }
    if (this.state.pausedSince != null) {
      this.endPause(now);
    }
    // A closed session keeps no position: the track lives in the point log (then the activity log).
    this.state = { ...this.state, status: 'finished', endedAt: now, ...NO_POSITION };
    this.record({
      type: 'SessionFinished',
      v: 1,
      at: now,
      sessionId: this.id,
      activityType: this.state.type,
      startedAt: this.state.startedAt,
      endedAt: now,
      resumedSegments: this.state.resumedSegments ? [...this.state.resumedSegments] : null,
    });
  }

  discard(now: number): void {
    this.assertActive();
    this.state = { ...this.state, status: 'discarded', endedAt: now, ...NO_POSITION };
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
        this.state = { ...this.state, status: 'autoPaused', pausedSince: t, pauseAnchor: null, recent: [] };
        this.record({ type: 'SessionPaused', v: 1, at: t, sessionId: s.id, auto: true });
      }
    } else {
      this.state = { ...s, slowSince: null };
      if (s.status === 'autoPaused') {
        this.endPause(t);
        this.state = { ...this.state, status: 'recording', pauseAnchor: null };
        this.record({ type: 'SessionResumed', v: 1, at: t, sessionId: s.id, auto: true, segment: s.segment });
      }
    }
  }

  private endPause(now: number) {
    const s = this.state;
    if (s.pausedSince == null) {
      return;
    }
    this.state = { ...s, pausedMs: s.pausedMs + Math.max(0, now - s.pausedSince), pausedSince: null };
  }

  private assertActive() {
    if (!this.isActive) {
      throw new DomainError('session.not-active', this.state.status);
    }
  }

  private record(e: RecordingEvent) {
    this.events.push(e);
  }
}
