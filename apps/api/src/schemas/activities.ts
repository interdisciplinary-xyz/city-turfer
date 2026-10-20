import { z } from '@hono/zod-openapi';

import { ActivityType, BoundingBox, IsoDateTime, LonLat, TimeZone } from './common';

/** Activity Log: finished activities and their tracks (recorded on the phone or imported). */

export const ActivitySource = z.enum(['recording', 'apple-health']).openapi('ActivitySource');

/**
 * One track point, compact (Vercel caps bodies at 4.5 MB):
 * `[lon, lat, t (epoch ms), segment, altitudeM | null, accuracyM | null, speedMps | null]`.
 */
export const TrackPoint = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().int(),
    z.number().int().min(0),
    z.number().nullable(),
    z.number().nullable(),
    z.number().nullable(),
  ])
  .openapi('TrackPoint', { example: [21.0122, 52.2297, 1760857920000, 0, 98.5, 5, 2.9] });

export const Track = z
  .object({
    points: z.array(TrackPoint).max(40_000),
  })
  .openapi('Track');

export const ActivitySummary = z
  .object({
    id: z.string().openapi({ example: '3f9c2a64-5d1e-4b8e-9a51-0c7d2e6f1b20' }),
    type: ActivityType,
    name: z.string().openapi({ example: 'Morning run' }),
    source: ActivitySource,
    startedAt: IsoDateTime,
    endedAt: IsoDateTime,
    timeZone: TimeZone,
    distanceM: z.number().openapi({ example: 5020 }),
    estimatedDistanceM: z
      .number()
      .openapi({ description: 'Part of distanceM estimated along streets over GPS gaps.', example: 0 }),
    movingS: z.number().openapi({ example: 1694 }),
    elapsedS: z.number().openapi({ example: 1760 }),
    elevationGainM: z.number().nullable().openapi({ example: 24 }),
    preview: z.array(LonLat).openapi({ description: 'Simplified track for list maps.' }),
  })
  .openapi('ActivitySummary');

export const ActivityList = z
  .object({
    items: z.array(ActivitySummary),
    nextBefore: IsoDateTime.nullable().openapi({ description: 'Pass as `before` for the next page; null at the end.' }),
  })
  .openapi('ActivityList');

export const ActivityListQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .openapi({ param: { name: 'limit', in: 'query' }, example: 50 }),
  before: IsoDateTime.optional().openapi({ param: { name: 'before', in: 'query' } }),
});

export const Split = z
  .object({
    km: z.number().int().openapi({ example: 1 }),
    durationS: z.number().openapi({ example: 337 }),
  })
  .openapi('Split');

export const ActivityDetail = ActivitySummary.extend({
  bbox: BoundingBox.nullable(),
  splits: z.array(Split),
}).openapi('ActivityDetail');

/** Upload of a finished activity. The server computes the summary and claims turf from the track. */
export const ActivityUpload = z
  .object({
    type: ActivityType,
    name: z.string().min(1).max(120).optional().openapi({ description: 'Defaults like the app (e.g. "Morning run").' }),
    source: ActivitySource,
    startedAt: IsoDateTime,
    endedAt: IsoDateTime,
    timeZone: TimeZone,
    track: Track,
  })
  .openapi('ActivityUpload');

export const ActivityRename = z
  .object({ name: z.string().min(1).max(120).openapi({ example: 'Sunday long run' }) })
  .openapi('ActivityRename');
