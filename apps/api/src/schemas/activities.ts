import { z } from '@hono/zod-openapi';

import { ActivityType, BoundingBox, Cursor, IsoDateTime, Limit, LonLat, TimeZone } from './common';

/**
 * Activity Log: finished activities and their tracks (recorded on the phone or imported). The phone
 * is authoritative for what it uploads; the server recomputes the summary with the shared core.
 */

export const ActivitySource = z.enum(['recording', 'apple-health', 'import']).openapi('ActivitySource', {
  description:
    '`recording`: a finished Recording Session; `apple-health`: imported from Apple Health (`hk-…` id, needs the `apple-health-in-cloud-sync` consent); `import`: any other import. Demo history (`demo-…`) is never uploaded.',
  example: 'recording',
});

/** Upper bound of points per track: a 10 h ride at 1 Hz, ~2 MB as JSON (Vercel caps bodies at 4.5 MB). */
export const MAX_TRACK_POINTS = 40_000;

/** One track point, compact: `[lon, lat, t (epoch ms), segment, altitudeM | null]`. */
export const TrackPoint = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().int(),
    z.number().int().min(0),
    z.number().nullable(),
  ])
  .openapi('TrackPoint', {
    description:
      'Columns: `[lon, lat, t, segment, altitudeM]` — longitude and latitude (degrees, WGS 84), time (epoch ms, UTC), segment number (a new segment starts after a pause or GPS gap; segments are never bridged), altitude in metres or null. Accuracy and speed are not sent (data minimisation, decision D1).',
    example: [21.0122, 52.2297, 1760857920000, 0, 98.5],
  });

export const Track = z
  .object({
    points: z
      .array(TrackPoint)
      .min(2)
      .max(MAX_TRACK_POINTS)
      .openapi({
        example: [
          [21.0122, 52.2297, 1760857920000, 0, 98.5],
          [21.0125, 52.2299, 1760857923000, 0, 98.7],
          [21.0129, 52.2301, 1760857926000, 0, 98.9],
        ],
      }),
  })
  .openapi('Track', { description: 'Every point of an activity, in time order. Personal data.' });

export const TrackHash = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .openapi({
    description:
      'Canonical track hash: SHA-256 (lowercase hex) of the UTF-8 bytes of `JSON.stringify(track.points)` — no whitespace, points `[lon, lat, t, segment, altitudeM | null]` in upload order, numbers in ECMAScript shortest round-trip form (what `JSON.stringify` writes). The server computes it; a hash the client sends must match (422 `activity.track-hash-mismatch`). Tells other devices whether to download the track again.',
    example: '9f2b6c1d4e8a7b3c5d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e',
  });

export const ActivityName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .openapi({ description: 'As in the app (1–80 characters).', example: 'Morning run' });

export const ActivityVersion = z
  .number()
  .int()
  .min(1)
  .openapi({ description: 'Grows by one with every change; the `ETag` is `"v<version>"`.', example: 3 });

export const ActivitySummary = z
  .object({
    id: z.string().openapi({ example: '3f9c2a64-5d1e-4b8e-9a51-0c7d2e6f1b20' }),
    type: ActivityType,
    name: ActivityName,
    source: ActivitySource,
    startedAt: IsoDateTime,
    endedAt: IsoDateTime,
    timeZone: TimeZone.nullable().openapi({ description: 'IANA zone the phone reported; display only.' }),
    distanceM: z.number().openapi({ description: 'Recorded + estimated over GPS gaps.', example: 5020 }),
    estimatedDistanceM: z
      .number()
      .openapi({ description: 'Part of distanceM estimated along streets over GPS gaps (D3).', example: 0 }),
    movingS: z.number().openapi({ description: 'Recorded + estimated moving time.', example: 1694 }),
    elapsedS: z.number().openapi({ example: 1760 }),
    elevationGainM: z.number().nullable().openapi({ example: 24 }),
    preview: z.array(LonLat).openapi({ description: 'Simplified track for list maps.' }),
    pointCount: z.number().int().openapi({ example: 1412 }),
    trackHash: TrackHash,
    version: ActivityVersion,
    updatedAt: IsoDateTime,
    coreVersion: z
      .string()
      .openapi({ description: 'Version of the shared core that computed the numbers.', example: '0.8.0' }),
  })
  .openapi('ActivitySummary');

export const ActivityList = z
  .object({
    items: z.array(ActivitySummary),
    nextCursor: z.string().nullable().openapi({ description: 'Pass as `cursor` for the next page; null at the end.' }),
  })
  .openapi('ActivityList');

export const ActivityListQuery = z.object({
  limit: Limit,
  cursor: Cursor,
  type: ActivityType.optional().openapi({ param: { name: 'type', in: 'query' } }),
});

export const Split = z
  .object({
    km: z.number().int().openapi({ example: 1 }),
    movingS: z.number().openapi({ description: 'Moving time of this kilometre (not cumulative).', example: 337 }),
  })
  .openapi('Split');

export const GapRoute = z
  .object({
    afterSegment: z.number().int().min(0).openapi({ description: 'The gap after this segment.', example: 0 }),
    distanceM: z.number().min(0).openapi({ example: 240 }),
    movingS: z.number().min(0).openapi({ example: 85 }),
    coords: z
      .array(LonLat)
      .min(2)
      .max(5000)
      .openapi({
        example: [
          [21.0129, 52.2301],
          [21.0141, 52.2307],
        ],
      }),
  })
  .openapi('GapRoute', {
    description:
      'A street route the phone estimated across a GPS gap: counted in distance, drawn dashed, never claimed as turf. The server never computes these (D3).',
  });

export const ActivityDetail = ActivitySummary.extend({
  bbox: BoundingBox.nullable(),
  splits: z.array(Split),
  resumedSegments: z
    .array(z.number().int().min(0))
    .nullable()
    .openapi({ description: 'Segments that began with a manual Resume; null when unknown.' }),
  gapRoutes: z.array(GapRoute),
  gapsCheckedAt: IsoDateTime.nullable().openapi({
    description:
      'When the phone last checked the GPS gaps (`PUT …/gap-routes`, an empty list included); null when never checked or since the track changed. A restoring phone that sees a time here does not estimate the gaps again.',
  }),
}).openapi('ActivityDetail');

/** What the changes feed carries per activity: enough to plan a restore or a pull, no geometry. */
export const ActivityFeedEntry = ActivitySummary.pick({
  id: true,
  type: true,
  source: true,
  name: true,
  startedAt: true,
  version: true,
  trackHash: true,
  updatedAt: true,
}).openapi('ActivityFeedEntry', {
  description:
    'An activity in the changes feed: no preview or numbers (pages stay small). Fetch `GET /v1/activities/{id}` and, when `trackHash` is new, `GET /v1/activities/{id}/track`.',
});

/** Upload of a finished activity. The server recomputes the summary and claims turf from the track. */
export const ActivityUpload = z
  .object({
    type: ActivityType,
    name: ActivityName,
    source: ActivitySource,
    startedAt: IsoDateTime,
    endedAt: IsoDateTime,
    timeZone: TimeZone.optional().openapi({
      description: 'IANA zone; for activities recorded before sync, the phone sends its current zone.',
    }),
    resumedSegments: z
      .array(z.number().int().min(0))
      .nullable()
      .openapi({
        description: 'Segments that began with a manual Resume (tells a pause from a GPS gap); null when unknown.',
        example: [2],
      }),
    trackHash: TrackHash.optional().openapi({
      description: 'Optional (0.3.0): when sent, the server checks it against the canonical hash of `track.points`.',
    }),
    track: Track,
  })
  .openapi('ActivityUpload');

export const ActivityRename = z.object({ name: ActivityName }).openapi('ActivityRename');

export const GapRoutesUpload = z
  .object({
    checkedAt: IsoDateTime.openapi({ description: 'When the phone checked the gaps (`gapsCheckedAt`).' }),
    routes: z.array(GapRoute).max(200),
  })
  .openapi('GapRoutesUpload', {
    description: 'Replaces every gap route of the activity; an empty list means checked, no gaps.',
  });
