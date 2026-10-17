import {
  type ActivityType,
  type Clock,
  type GeoPoint,
  segmentCount,
  splitAtGaps,
  trackFromPoints,
  type TrackPoint,
} from '@/shared-kernel';

import type { ActivityDetail, ActivityListItem } from '../contract';
import { Activity } from '../domain/activity';
import type { ActivityRepository } from '../domain/activity-repository';
import { acceptRoute, estimatedTotals, type GapRoute, gapsOf } from '../domain/gap-route';

/** Port: the finished track of a recording session (Recording's open-host service). */
export interface FinishedTrackSource {
  trackOf(sessionId: string): Promise<TrackPoint[] | null>;
}

/**
 * Port: street routing between two points (e.g. OSM). Resolves null when no
 * route exists; rejects on network/service errors (the caller retries later).
 */
export interface RouteEstimator {
  route(
    from: GeoPoint,
    to: GeoPoint,
    type: ActivityType
  ): Promise<{ distanceM: number; coords: [number, number][] } | null>;
}

export interface ActivityLogDeps {
  activities: ActivityRepository;
  finishedTracks: FinishedTrackSource;
  router: RouteEstimator;
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

/**
 * Data repair: tracks recorded before gaps started new segments contain straight
 * lines across GPS outages. Re-split them; Territory rebuilds the claim on
 * ActivityTrackCorrected. Idempotent: a repaired track has nothing left to split.
 */
export class SplitTrackGaps {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(): Promise<{ checked: number; corrected: number }> {
    const ids = await this.d.activities.allIds();
    let corrected = 0;
    for (const id of ids) {
      const points = await this.d.activities.trackOf(id);
      const fixed = splitAtGaps(points);
      if (segmentCount(fixed) === segmentCount(points)) continue;
      const activity = await this.d.activities.get(id);
      if (!activity) continue;
      activity.correctTrack(trackFromPoints(fixed), this.d.clock.now());
      await this.d.activities.saveCorrection(activity, fixed);
      corrected++;
    }
    if (corrected > 0) this.d.afterCommit();
    return { checked: ids.length, corrected };
  }
}

/**
 * Estimates the path across each recording gap along streets: counted in
 * distance (marked as estimated), drawn dashed, never claimed as turf.
 * Activities stay unchecked while the router is unreachable, so this is
 * simply re-run later (launch, after new activities).
 */
export class EstimateGapRoutes {
  private running: Promise<number> | null = null;
  constructor(private readonly d: ActivityLogDeps) {}

  execute(): Promise<number> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<number> {
    let done = 0;
    for (const id of await this.d.activities.idsWithUncheckedGaps()) {
      const type = await this.d.activities.typeOf(id);
      if (!type) continue;
      const routes: GapRoute[] = [];
      for (const gap of gapsOf(trackFromPoints(await this.d.activities.trackOf(id)))) {
        const r = await this.d.router.route(gap.from, gap.to, type); // throws when offline → retry later
        if (r && acceptRoute(type, gap, r.distanceM)) {
          routes.push({
            afterSegment: gap.afterSegment,
            distanceM: r.distanceM,
            movingS: gap.durationS,
            coords: r.coords,
          });
        }
      }
      await this.d.activities.saveGapRoutes(id, routes, this.d.clock.now());
      done++;
    }
    if (done > 0) this.d.afterCommit();
    return done;
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
    const gapRoutes = await this.d.activities.gapRoutesOf(id);
    const estimated = estimatedTotals(gapRoutes);
    return {
      id: s.id,
      type: s.type,
      name: s.name,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      distanceM: s.summary.distanceM + estimated.distanceM,
      movingS: s.summary.movingS + estimated.movingS,
      estimatedDistanceM: estimated.distanceM,
      gapRoutes: gapRoutes.map((r) => ({ afterSegment: r.afterSegment, coords: [...r.coords] })),
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
