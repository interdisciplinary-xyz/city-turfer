import { Activity, estimatedTotals } from '@cityturfer/core/activity-log/ports';
import corePackage from '@cityturfer/core/package.json' with { type: 'json' };
import { trackFromPoints, type TrackPoint } from '@cityturfer/core/shared-kernel';

import type { ActivitySourceName, ActivityTypeName, CompactPoint, StoredGapRoute, StoredSummary } from './model';

/** Version of the shared core that computes the numbers (answered as `coreVersion`). */
export const CORE_VERSION: string = corePackage.version;

/**
 * Runs the Activity Log's own rules on an upload: `Activity.record` (track at least two points,
 * end not before start; distance, moving time, splits, elevation, bbox and preview from the
 * shared kernel) and `rename` (1–80 characters). A broken rule throws the core's DomainError,
 * which the API answers as 422 with its code. No business rule is re-implemented here.
 */
export function summarizeUpload(input: {
  id: string;
  type: ActivityTypeName;
  name: string;
  source: ActivitySourceName;
  startedAt: number;
  endedAt: number;
  resumedSegments: readonly number[] | null;
  points: readonly CompactPoint[];
  now: number;
}): { name: string; summary: StoredSummary } {
  const points: TrackPoint[] = input.points.map(([lon, lat, t, segment, alt]) => ({
    lon,
    lat,
    t,
    segment,
    alt,
    accuracy: null,
    speed: null,
  }));
  const activity = Activity.record({
    id: input.id,
    type: input.type,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    track: trackFromPoints(points),
    now: input.now,
    resumedSegments: input.resumedSegments,
    origin: input.source === 'recording' ? 'recording' : 'import',
  });
  activity.rename(input.name);
  const s = activity.toState();
  return {
    name: s.name,
    summary: {
      distanceM: s.summary.distanceM,
      movingS: s.summary.movingS,
      elapsedS: s.summary.elapsedS,
      elevationGainM: s.summary.elevGainM,
      splits: s.summary.splits.map((x) => ({ km: x.km, movingS: x.seconds })),
      bbox: s.bbox ? [s.bbox[0], s.bbox[1], s.bbox[2], s.bbox[3]] : null,
      preview: s.preview.map(([lon, lat]) => [lon, lat]),
      pointCount: input.points.length,
      coreVersion: CORE_VERSION,
    },
  };
}

/** Distance and moving time the phone's gap routes add (the core's rule). */
export function gapTotals(routes: readonly StoredGapRoute[]): { distanceM: number; movingS: number } {
  return estimatedTotals(routes);
}
