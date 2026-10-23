import { z } from '@hono/zod-openapi';

import { ActivityType, BoundingBox, IsoDateTime, LonLat } from './common';

/**
 * Territory: turf cells (H3 res 11), claims, the summary and the Home City. The server recomputes
 * all of it from uploaded tracks with the shared core; phones never upload turf.
 */

/** Made up (not a real user's cell): an H3 res-11 index. */
const CELL_EXAMPLE = '8b1f53cae5a3fff';

export const TurfCellCounts = z
  .tuple([z.string(), z.number().int().min(0), z.number().int().min(0), z.number().int().min(0)])
  .openapi('TurfCellCounts', {
    description:
      'One Turf Cell: `[h3Id, walk, run, cycle]` — the H3 index (resolution 11) and how many activities of each type covered it. Visits = walk + run + cycle; strength (`1 − exp(−visits/3)`) and tier derive from visits with the Territory rules of the shared core, as on the phone. No polygon or centroid: draw the cell from its id (h3-js `cellToBoundary`).',
    example: [CELL_EXAMPLE, 2, 1, 0],
  });

export const TurfCells = z
  .object({
    turfVersion: z.number().int().min(0).openapi({
      description: 'The version of the turf this page belongs to (+1 on every change).',
      example: 42,
    }),
    total: z.number().int().min(0).openapi({ description: 'Cells in the whole download.', example: 1530 }),
    cells: z.array(TurfCellCounts).openapi({ description: 'Sorted by cell id.' }),
    nextCursor: z
      .string()
      .nullable()
      .openapi({ description: 'Pass as `cursor` for the next page; null on the last page.', example: null }),
  })
  .openapi('TurfCells');

export const TurfCellsQuery = z.object({
  cursor: z
    .string()
    .min(1)
    .max(256)
    .optional()
    .openapi({
      param: { name: 'cursor', in: 'query' },
      description:
        'Opaque: `nextCursor` of the previous page; omit for the first. Bound to a turf version: after a change it answers `410 turf.changed`.',
      example: 'eyJ2Ijo0MiwiYyI6Im1nemhmZzAwIiwibyI6MjAwMDB9',
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50_000)
    .default(20_000)
    .openapi({ param: { name: 'limit', in: 'query' }, description: 'Cells per page.', example: 20_000 }),
});

export const TurfSummary = z
  .object({
    cellCount: z.number().int().openapi({ example: 1530 }),
    areaKm2: z.number().openapi({ example: 3.02 }),
    strongCells: z.number().int().openapi({ example: 686 }),
    newThisWeekKm2: z.number().openapi({ example: 0.06 }),
    newThisMonthKm2: z.number().openapi({ example: 0.41 }),
    byType: z.record(ActivityType, z.number().int()).openapi({ example: { walk: 820, run: 610, cycle: 300 } }),
  })
  .openapi('TurfSummary');

export const Claim = z
  .object({
    activityId: z.string().openapi({ example: '3f9c2a64-5d1e-4b8e-9a51-0c7d2e6f1b20' }),
    cellCount: z.number().int().openapi({ example: 412 }),
    newCellCount: z.number().int().openapi({ example: 37 }),
    newAreaKm2: z.number().openapi({ example: 0.07 }),
    cells: z
      .array(z.object({ id: z.string().openapi({ example: CELL_EXAMPLE }), isNew: z.boolean() }))
      .openapi({ description: 'Sorted by cell id.' }),
  })
  .openapi('Claim', {
    description:
      'The cells one activity covered. A cell is *new* for the claim with the earliest `(startedAt, activityId)` that covers it (decision D4), so the answer does not depend on upload order; it can change when an older activity arrives later.',
  });

export const City = z
  .object({
    id: z.string().openapi({ description: 'Stable catalogue id.', example: 'pl-warsaw' }),
    name: z.string().openapi({ example: 'Warsaw' }),
    country: z.string().length(2).openapi({ example: 'PL' }),
    center: LonLat,
    bounds: BoundingBox,
  })
  .openapi('City');

export const HomeCity = z
  .object({
    city: City.nullable(),
    chosenAt: IsoDateTime.nullable().openapi({ description: 'Null when never chosen.' }),
  })
  .openapi('HomeCity');

export const ChooseHomeCityBody = z
  .object({
    cityId: z
      .string()
      .min(1)
      .max(64)
      .nullable()
      .openapi({ description: 'A catalogue city id, or null to clear.', example: 'pl-krakow' }),
    chosenAt: IsoDateTime.openapi({
      description: 'When the user chose it on the phone; the latest `chosenAt` wins (offline-safe).',
    }),
  })
  .openapi('ChooseHomeCityBody');
