import { ELEV_HYSTERESIS_M, MOVING_SPEED_MPS } from '@/constants/tracking';
import {
  type ActivityType,
  analyzeTrack,
  type BoundingBox,
  boundingBoxOf,
  DomainError,
  pointsOf,
  simplify,
  type Split,
  type Track,
} from '@/shared-kernel';

import type { ActivityDeleted, ActivityRecorded, ActivityTrackCorrected } from '../contract';
import { acceptRoute, estimatedMovingS, type Gap, type GapRoute, routableGaps } from './gap-route';

export interface ActivitySummary {
  readonly distanceM: number;
  readonly movingS: number;
  readonly elapsedS: number;
  readonly elevGainM: number | null;
  readonly splits: readonly Split[];
}

export interface ActivityState {
  readonly id: string;
  readonly type: ActivityType;
  readonly name: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly summary: ActivitySummary;
  readonly bbox: BoundingBox | null;
  readonly preview: readonly [number, number][];
  /** Segment numbers that began with a manual Resume; null when unknown (older or imported activity). */
  readonly resumedSegments: readonly number[] | null;
}

type ActivityEvent = ActivityRecorded | ActivityDeleted | ActivityTrackCorrected;

export function defaultName(type: ActivityType, startedAt: number): string {
  const h = new Date(startedAt).getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} ${{ walk: 'walk', run: 'run', cycle: 'ride' }[type]}`;
}

/** Aggregate root of the Activity Log: a finished, saved recording. */
export class Activity {
  private events: ActivityEvent[] = [];
  private constructor(private state: ActivityState) {}

  static record(input: {
    id: string;
    type: ActivityType;
    startedAt: number;
    endedAt: number;
    track: Track;
    now: number;
    resumedSegments?: readonly number[] | null;
  }): Activity {
    const points = pointsOf(input.track);
    if (points.length < 2) throw new DomainError('activity.track-too-short');
    if (input.endedAt < input.startedAt) throw new DomainError('activity.ends-before-start');
    const a = new Activity({
      id: input.id,
      type: input.type,
      name: defaultName(input.type, input.startedAt),
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      ...derive(input.type, input.track, input.startedAt, input.endedAt),
      resumedSegments: input.resumedSegments ? [...input.resumedSegments] : null,
    });
    a.events.push({
      type: 'ActivityRecorded',
      v: 1,
      at: input.now,
      activityId: input.id,
      activityType: input.type,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    });
    return a;
  }

  static rehydrate(state: ActivityState) {
    return new Activity(state);
  }

  get id() {
    return this.state.id;
  }
  toState() {
    return this.state;
  }

  rename(name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) throw new DomainError('activity.invalid-name');
    this.state = { ...this.state, name: trimmed };
  }

  /** Replace the track (same fixes, corrected segmentation): totals, bbox and preview are recomputed. */
  correctTrack(track: Track, now: number) {
    if (pointsOf(track).length < 2) throw new DomainError('activity.track-too-short');
    const s = this.state;
    // Segments are renumbered by a correction, so which ones began with a Resume is no longer known.
    this.state = { ...s, ...derive(s.type, track, s.startedAt, s.endedAt), resumedSegments: null };
    this.events.push({
      type: 'ActivityTrackCorrected',
      v: 1,
      at: now,
      activityId: s.id,
      activityType: s.type,
      startedAt: s.startedAt,
    });
  }

  /** Breaks of this activity's track worth estimating along streets (GPS gaps, not pauses; not near home). */
  gapsToRoute(track: Track): Gap[] {
    return routableGaps(track, this.state.resumedSegments);
  }

  /** A routed path across one of its gaps, or null when nobody doing this activity could have taken it. */
  gapRoute(gap: Gap, route: { distanceM: number; coords: readonly [number, number][] }): GapRoute | null {
    if (!acceptRoute(this.state.type, gap, route.distanceM)) return null;
    return {
      afterSegment: gap.afterSegment,
      distanceM: route.distanceM,
      movingS: estimatedMovingS(gap.durationS, route.distanceM, this.avgMovingSpeedMps()),
      coords: route.coords.map(([lon, lat]) => [lon, lat] as [number, number]),
    };
  }

  /** Data repair for routes estimated before moving time was capped: `movingS` then held the whole gap duration. */
  capGapRoute(route: GapRoute): GapRoute {
    const movingS = estimatedMovingS(route.movingS, route.distanceM, this.avgMovingSpeedMps());
    return movingS === route.movingS ? route : { ...route, movingS };
  }

  markDeleted(now: number) {
    this.events.push({ type: 'ActivityDeleted', v: 1, at: now, activityId: this.state.id });
  }

  pullEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  private avgMovingSpeedMps(): number {
    const { distanceM, movingS } = this.state.summary;
    return movingS > 0 ? distanceM / movingS : 0;
  }
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

function derive(type: ActivityType, track: Track, startedAt: number, endedAt: number) {
  const points = pointsOf(track);
  const stats = analyzeTrack(track, MOVING_SPEED_MPS[type], ELEV_HYSTERESIS_M[type]);
  return {
    summary: { ...stats, elapsedS: Math.round((endedAt - startedAt) / 1000) },
    bbox: boundingBoxOf(points),
    preview: simplify(points, 15).map((p) => [round5(p.lon), round5(p.lat)] as [number, number]),
  };
}
