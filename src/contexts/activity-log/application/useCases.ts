import { type ActivityType, type Clock, trackFromPoints, type TrackPoint } from '@/shared-kernel';

import type { ActivityDetail, ActivityListItem } from '../contract';
import { Activity } from '../domain/Activity';
import type { ActivityRepository } from '../domain/ActivityRepository';

/** Port: the finished track of a recording session (Recording's open-host service). */
export interface FinishedTrackSource {
  trackOf(sessionId: string): Promise<TrackPoint[] | null>;
}

export interface ActivityLogDeps {
  activities: ActivityRepository;
  finishedTracks: FinishedTrackSource;
  clock: Clock;
  afterCommit: () => void;
}

export interface SessionFinishedPayload {
  sessionId: string;
  activityType: ActivityType;
  startedAt: number;
  endedAt: number;
}

/** Handles SessionFinished. Idempotent: activity id = session id. */
export class RecordActivityFromSession {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(e: SessionFinishedPayload): Promise<void> {
    if (await this.d.activities.exists(e.sessionId)) return;
    const points = await this.d.finishedTracks.trackOf(e.sessionId);
    if (!points || points.length < 2) return; // nothing to record
    const activity = Activity.record({
      id: e.sessionId,
      type: e.activityType,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      track: trackFromPoints(points),
      now: this.d.clock.now(),
    });
    await this.d.activities.save(activity, points);
    this.d.afterCommit();
  }
}

/** Dev/demo: create an activity from an existing track (e.g. seeded history, GPX). */
export class ImportActivity {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(input: { id: string; type: ActivityType; points: TrackPoint[] }): Promise<boolean> {
    if (input.points.length < 2 || (await this.d.activities.exists(input.id))) return false;
    const activity = Activity.record({
      id: input.id,
      type: input.type,
      startedAt: input.points[0].t,
      endedAt: input.points[input.points.length - 1].t,
      track: trackFromPoints(input.points),
      now: this.d.clock.now(),
    });
    await this.d.activities.save(activity, input.points);
    this.d.afterCommit();
    return true;
  }
}

export class ListActivities {
  constructor(private readonly d: ActivityLogDeps) {}
  execute(limit = 30, before?: number): Promise<ActivityListItem[]> {
    return this.d.activities.list(limit, before);
  }
}

export class GetActivityDetail {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(id: string): Promise<ActivityDetail | null> {
    const a = await this.d.activities.get(id);
    if (!a) return null;
    const s = a.toState();
    return {
      id: s.id,
      type: s.type,
      name: s.name,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      distanceM: s.summary.distanceM,
      movingS: s.summary.movingS,
      elapsedS: s.summary.elapsedS,
      elevGainM: s.summary.elevGainM,
      splits: [...s.summary.splits],
      bbox: s.bbox ? ([...s.bbox] as [number, number, number, number]) : null,
      preview: [...s.preview],
      track: await this.d.activities.trackOf(id),
    };
  }
}

export class RenameActivity {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(id: string, name: string): Promise<void> {
    const a = await this.d.activities.get(id);
    if (!a) return;
    a.rename(name);
    await this.d.activities.save(a);
  }
}

export class DeleteActivity {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(id: string): Promise<void> {
    const a = await this.d.activities.get(id);
    if (!a) return;
    a.markDeleted(this.d.clock.now());
    await this.d.activities.delete(a);
    this.d.afterCommit();
  }
}

/** Open-host service for Territory. */
export class ActivityTrackQuery {
  constructor(private readonly d: Pick<ActivityLogDeps, 'activities'>) {}
  execute(id: string): Promise<TrackPoint[]> {
    return this.d.activities.trackOf(id);
  }
}
