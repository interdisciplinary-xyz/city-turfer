import { z } from '@hono/zod-openapi';

import { ActivityFeedEntry } from './activities';
import { Cursor, IsoDateTime } from './common';

/**
 * Sync: one feed of what changed for the user, in server order (docs/decisions/
 * api-sync-2026-10-20.md, "Sync protocol"). Tracks are not inline: fetch them when `trackHash` is new.
 */

const changedAt = IsoDateTime.openapi({ description: 'When the server recorded the change.' });

export const ActivityUpserted = z
  .object({
    type: z.literal('activity.upserted'),
    changedAt,
    activity: ActivityFeedEntry,
  })
  .openapi('ActivityUpserted', {
    description:
      'Created or changed (track, name, gap routes). Download the track only when `activity.trackHash` differs from yours.',
  });

export const ActivityTombstone = z
  .object({
    type: z.literal('activity.deleted'),
    changedAt,
    activityId: z.string().openapi({ example: '3f9c2a64-5d1e-4b8e-9a51-0c7d2e6f1b20' }),
    deletedAt: IsoDateTime,
  })
  .openapi('ActivityTombstone', {
    description: 'Deleted: delete it locally and never upload it again (it would answer 410).',
  });

export const HomeCityChanged = z
  .object({
    type: z.literal('home-city.chosen'),
    changedAt,
    cityId: z.string().nullable().openapi({ example: 'pl-warsaw' }),
    chosenAt: IsoDateTime,
  })
  .openapi('HomeCityChanged', { description: 'Apply when `chosenAt` is newer than yours (last write wins).' });

export const Change = z
  .discriminatedUnion('type', [ActivityUpserted, ActivityTombstone, HomeCityChanged])
  .openapi('Change');

export const ChangesPage = z
  .object({
    changes: z.array(Change),
    nextCursor: z.string().openapi({
      description: 'Always present: store it and pass it next time, even when `hasMore` is false.',
      example: 'eyJzIjoxMjh9',
    }),
    hasMore: z.boolean().openapi({
      description: 'True: ask again now with `nextCursor`. A page ends at `limit` changes or about 1 MB.',
      example: false,
    }),
  })
  .openapi('ChangesPage');

export const ChangesQuery = z.object({
  cursor: Cursor.openapi({
    description:
      'Opaque `nextCursor` of the previous call. Omit it to get everything (the manifest for a first upload, a reinstall or a new device).',
  }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .default(200)
    .openapi({ param: { name: 'limit', in: 'query' }, example: 200 }),
});
