import {
  type ActivityType,
  type Clock,
  type GeoPoint,
  segmentCount,
  splitAtGaps,
  trackFromPoints,
  type TrackPoint,
} from '../../../shared-kernel';
import type { ActivityArchive, ActivityDetail, ActivityListItem, RestoredActivity, RestoreOutcome } from '../contract';
import { Activity } from '../domain/activity';
import type { ActivityRepository } from '../domain/activity-repository';
import { estimatedTotals, type GapRoute } from '../domain/gap-route';
import { OFFLINE_RETRY_MS, RouterBudget } from './router-budget';

/** Port: the finished track of a recording session (Recording's open-host service). */
export interface FinishedTrackSource {
  trackOf(sessionId: string): Promise<TrackPoint[] | null>;
}

/**
 * Port: street routing between two points (e.g. OSM). Resolves null when no
 * route exists. Rejects with RouterRateLimited (stop asking for a while),
 * RouterUnreachable (offline: stop this run) or any other error (this gap failed;
 * the activity is retried later with backoff).
 */
export interface RouteEstimator {
  route(
    from: GeoPoint,
    to: GeoPoint,
    type: ActivityType
  ): Promise<{ distanceM: number; coords: [number, number][] } | null>;
}

/** The router asked us to slow down (HTTP 429). */
export class RouterRateLimited extends Error {
  constructor(readonly retryAfterMs: number | null) {
    super('router rate limited');
    this.name = 'RouterRateLimited';
  }
}

/** The router could not be reached at all (device offline, DNS…). */
export class RouterUnreachable extends Error {
  constructor(message = 'router unreachable') {
    super(message);
    this.name = 'RouterUnreachable';
  }
}

/** Port: the user's "Estimate GPS gaps along streets" setting (on unless turned off). */
export interface GapEstimationSetting {
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
}

/** When the router may be used: only with the setting on and while the app is in the foreground. */
export interface GapRoutingEnvironment {
  setting: GapEstimationSetting;
  /** False on headless (background) launches: no network requests then. */
  isForeground(): boolean;
  /** Request pacing; tests pass a fake that does not really sleep. */
  wait(ms: number): Promise<void>;
}

export interface ActivityLogDeps {
  activities: ActivityRepository;
  finishedTracks: FinishedTrackSource;
  router: RouteEstimator;
  gapRouting: GapRoutingEnvironment;
  clock: Clock;
  afterCommit: () => void;
  /** The phone's IANA zone now, kept with each new Activity. Omitted: unknown (null). */
  timeZone?: () => string | null;
}

const zoneOf = (d: Pick<ActivityLogDeps, 'timeZone'>): string | null => {
  try {
    return d.timeZone?.() ?? null;
  } catch {
    return null;
  }
};

export interface SessionFinishedPayload {
  sessionId: string;
  activityType: ActivityType;
  startedAt: number;
  endedAt: number;
  /** Segments begun by a manual Resume (absent/null: unknown, recorded by an older build). */
  resumedSegments?: readonly number[] | null;
}

/** Handles SessionFinished. Idempotent: activity id = session id. */
export class RecordActivityFromSession {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(e: SessionFinishedPayload): Promise<void> {
    if (await this.d.activities.exists(e.sessionId)) {
      return;
    }
    const points = await this.d.finishedTracks.trackOf(e.sessionId);
    if (!points || points.length < 2) {
      return;
    } // nothing to record
    const activity = Activity.record({
      id: e.sessionId,
      type: e.activityType,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      track: trackFromPoints(points),
      now: this.d.clock.now(),
      resumedSegments: e.resumedSegments ?? null,
      timeZone: zoneOf(this.d),
    });
    await this.d.activities.save(activity, points);
    this.d.afterCommit();
  }
}

/** Create an activity from an existing track (demo history, Apple Health). Idempotent by id. */
export class ImportActivity {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(input: { id: string; type: ActivityType; points: TrackPoint[] }): Promise<boolean> {
    if (input.points.length < 2 || (await this.d.activities.exists(input.id))) {
      return false;
    }
    const activity = Activity.record({
      id: input.id,
      type: input.type,
      startedAt: input.points[0].t,
      endedAt: input.points[input.points.length - 1].t,
      track: trackFromPoints(input.points),
      now: this.d.clock.now(),
      origin: 'import',
      timeZone: zoneOf(this.d),
    });
    await this.d.activities.save(activity, input.points);
    this.d.afterCommit();
    return true;
  }
}

/**
 * Brings a backed-up Activity back (Restore from cloud backup): name, times, resumed segments, time
 * zone, the track and the gap routes as they were, in one transaction. Origin `restore`, so it is
 * claimed as turf but never exported to Apple Health or uploaded again; gap routes that were checked
 * keep their check time, so the street router is not asked again. One whose gaps the old phone never
 * checked (`gapsCheckedAt` null) stays unchecked and is estimated on this phone like any other, if
 * the Turfer has street estimation on. Idempotent by id.
 */
export class RestoreActivity {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(input: RestoredActivity): Promise<RestoreOutcome> {
    if (await this.d.activities.exists(input.id)) {
      return 'exists';
    }
    if (input.track.length < 2) {
      return 'invalid';
    }
    let activity: Activity;
    try {
      activity = Activity.restore({
        id: input.id,
        type: input.type,
        name: input.name,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        track: trackFromPoints(input.track),
        resumedSegments: input.resumedSegments,
        timeZone: input.timeZone,
        renamedAt: input.renamedAt,
        now: this.d.clock.now(),
      });
    } catch {
      return 'invalid'; // content this version can't hold (e.g. a name it doesn't accept)
    }
    const gaps =
      input.gapsCheckedAt != null
        ? { routes: input.gapRoutes.map((r) => ({ ...r })), checkedAt: input.gapsCheckedAt }
        : undefined;
    await this.d.activities.save(activity, input.track, gaps);
    this.d.afterCommit();
    return 'restored';
  }
}

/**
 * Data repair: Activities saved before the time zone was kept get the phone's current one, once.
 * Throws when the phone's zone can't be read, so a run-once job is not marked done and retries.
 */
export class AssignMissingTimeZones {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(): Promise<{ checked: number; assigned: number }> {
    const zone = zoneOf(this.d);
    if (!zone) {
      throw new Error('activity-log.time-zone-unknown');
    }
    const ids = await this.d.activities.idsWithoutTimeZone();
    let assigned = 0;
    for (const id of ids) {
      const a = await this.d.activities.get(id);
      if (a?.assignTimeZone(zone)) {
        await this.d.activities.save(a);
        assigned++;
      }
    }
    return { checked: ids.length, assigned };
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
      if (segmentCount(fixed) === segmentCount(points)) {
        continue;
      }
      const activity = await this.d.activities.get(id);
      if (!activity) {
        continue;
      }
      activity.correctTrack(trackFromPoints(fixed), this.d.clock.now());
      await this.d.activities.saveCorrection(activity, fixed);
      corrected++;
    }
    if (corrected > 0) {
      this.d.afterCommit();
    }
    return { checked: ids.length, corrected };
  }
}

/**
 * Estimates the path across each GPS gap along streets: counted in distance
 * (marked as estimated), drawn dashed, never claimed as turf. Manual pauses and
 * gaps near the activity's start or end are never sent. Runs only with the
 * setting on and the app in the foreground, paced by a RouterBudget; activities
 * stay unchecked while the router is unavailable, so this is simply re-run later
 * (launch, foreground, after new activities).
 */
export class EstimateGapRoutes {
  private running: Promise<number> | null = null;
  private readonly budget: RouterBudget;
  constructor(private readonly d: ActivityLogDeps) {
    this.budget = new RouterBudget(
      () => d.clock.now(),
      (ms) => d.gapRouting.wait(ms)
    );
  }

  execute(): Promise<number> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async allowed(): Promise<boolean> {
    return this.d.gapRouting.isForeground() && (await this.d.gapRouting.setting.isEnabled());
  }

  private async run(): Promise<number> {
    if (!(await this.allowed()) || !this.budget.beginRun()) {
      return 0;
    }
    let done = 0;
    activities: for (const id of await this.d.activities.idsWithUncheckedGaps()) {
      if (this.budget.isBackingOff(id)) {
        continue;
      }
      const activity = await this.d.activities.get(id);
      if (!activity) {
        continue;
      }
      const type = activity.toState().type;
      const routes: GapRoute[] = [];
      for (const gap of activity.gapsToRoute(trackFromPoints(await this.d.activities.trackOf(id)))) {
        if (!this.budget.hasRequestLeft()) {
          break activities;
        }
        await this.budget.acquire();
        if (!(await this.allowed())) {
          break activities;
        } // turned off or backgrounded while waiting
        let r: Awaited<ReturnType<RouteEstimator['route']>>;
        try {
          r = await this.d.router.route(gap.from, gap.to, type);
        } catch (e) {
          if (e instanceof RouterRateLimited) {
            this.budget.rateLimited(e.retryAfterMs);
          } else if (e instanceof RouterUnreachable) {
            this.budget.pauseFor(OFFLINE_RETRY_MS);
          } else {
            this.budget.failed(id); // only this activity waits; the others still get their turn
            continue activities;
          }
          break activities;
        }
        const route = r && activity.gapRoute(gap, r);
        if (route) {
          routes.push(route);
        }
      }
      this.budget.succeeded(id);
      await this.d.activities.saveGapRoutes(id, routes, this.d.clock.now());
      done++;
    }
    if (done > 0) {
      this.d.afterCommit();
    }
    return done;
  }
}

/**
 * Data repair: routes estimated before moving time was capped credited the whole
 * gap (a pause included) as moving time. Local only, no router requests.
 */
export class CapEstimatedMovingTime {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(): Promise<{ checked: number; capped: number }> {
    const ids = await this.d.activities.allIds();
    let capped = 0;
    for (const id of ids) {
      const routes = await this.d.activities.gapRoutesOf(id);
      if (routes.length === 0) {
        continue;
      }
      const activity = await this.d.activities.get(id);
      if (!activity) {
        continue;
      }
      const next = routes.map((r) => activity.capGapRoute(r));
      if (next.every((r, i) => r === routes[i])) {
        continue;
      }
      await this.d.activities.saveGapRoutes(id, next, this.d.clock.now());
      capped++;
    }
    if (capped > 0) {
      this.d.afterCommit();
    }
    return { checked: ids.length, capped };
  }
}

export class GetGapEstimationSetting {
  constructor(private readonly d: Pick<ActivityLogDeps, 'gapRouting'>) {}
  execute(): Promise<boolean> {
    return this.d.gapRouting.setting.isEnabled();
  }
}

export class SetGapEstimationSetting {
  constructor(private readonly d: Pick<ActivityLogDeps, 'gapRouting'>) {}
  execute(enabled: boolean): Promise<void> {
    return this.d.gapRouting.setting.setEnabled(enabled);
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
    if (!a) {
      return null;
    }
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
    if (!a) {
      return;
    }
    a.rename(name, this.d.clock.now());
    await this.d.activities.save(a);
    this.d.afterCommit();
  }
}

export class DeleteActivity {
  constructor(private readonly d: ActivityLogDeps) {}
  async execute(id: string): Promise<void> {
    const a = await this.d.activities.get(id);
    if (!a) {
      return;
    }
    a.markDeleted(this.d.clock.now());
    await this.d.activities.delete(a);
    this.d.afterCommit();
  }
}

/** Open-host service: Activities of a type overlapping a time range (e.g. to spot an imported duplicate). */
export class OverlappingActivitiesQuery {
  constructor(private readonly d: Pick<ActivityLogDeps, 'activities'>) {}
  execute(type: ActivityType, startedAt: number, endedAt: number) {
    return this.d.activities.overlapping(type, startedAt, endedAt);
  }
}

/** Open-host service for Territory. */
export class ActivityTrackQuery {
  constructor(private readonly d: Pick<ActivityLogDeps, 'activities'>) {}
  execute(id: string): Promise<TrackPoint[]> {
    return this.d.activities.trackOf(id);
  }
}

/**
 * Open-host service: every Activity, oldest first, as a complete copy (Cloud Backup). Read-only.
 */
export class ActivityArchiveQuery {
  constructor(private readonly d: Pick<ActivityLogDeps, 'activities'>) {}
  /** Every Activity's id, start and end, oldest first: cheap, no tracks loaded. */
  timeline(): Promise<{ id: string; startedAt: number; endedAt: number }[]> {
    return this.d.activities.timeline();
  }
  async of(id: string): Promise<ActivityArchive | null> {
    const a = await this.d.activities.get(id);
    if (!a) {
      return null;
    }
    const s = a.toState();
    const routes = await this.d.activities.gapRoutesOf(id);
    return {
      id: s.id,
      type: s.type,
      name: s.name,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      resumedSegments: s.resumedSegments ? [...s.resumedSegments] : null,
      track: await this.d.activities.trackOf(id),
      gapRoutes: routes.map((r) => ({
        afterSegment: r.afterSegment,
        distanceM: r.distanceM,
        movingS: r.movingS,
        coords: r.coords.map(([lon, lat]) => [lon, lat] as [number, number]),
      })),
      gapsCheckedAt: await this.d.activities.gapsCheckedAt(id),
      timeZone: s.timeZone,
      renamedAt: s.renamedAt,
    };
  }
}
