import { z } from '@hono/zod-openapi';

import { ActivityType, BoundingBox, LonLat } from './common';

/** Territory: turf cells (H3 res 11), claims, the summary, cities and the Home City. */

export const StrengthTier = z.enum(['faint', 'glowing', 'strong', 'blazing']).openapi('StrengthTier');

export const TurfCell = z
  .object({
    id: z
      .string()
      .openapi({ description: 'H3 cell index (res 11, or coarser when aggregated).', example: '8b1f53cae5a3fff' }),
    strength: z.number().min(0).max(1).openapi({ example: 0.63 }),
    tier: StrengthTier,
    visits: z.number().int().min(1).openapi({ example: 3 }),
    centroid: LonLat,
  })
  .openapi('TurfCell');

export const TurfCells = z.object({ cells: z.array(TurfCell) }).openapi('TurfCells');

export const TurfCellsQuery = z.object({
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .openapi({
      param: { name: 'bbox', in: 'query' },
      description: 'west,south,east,north',
      example: '20.85,52.12,21.17,52.34',
    }),
  zoom: z.coerce
    .number()
    .min(0)
    .max(22)
    .openapi({ param: { name: 'zoom', in: 'query' }, example: 13 }),
  types: z
    .string()
    .regex(/^(walk|run|cycle)(,(walk|run|cycle))*$/)
    .optional()
    .openapi({
      param: { name: 'types', in: 'query' },
      description: 'Comma-separated; all when omitted.',
      example: 'walk,run',
    }),
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
    activityId: z.string(),
    cellCount: z.number().int().openapi({ example: 412 }),
    newCellCount: z.number().int().openapi({ example: 37 }),
    newAreaKm2: z.number().openapi({ example: 0.07 }),
    cells: z.array(z.object({ id: z.string(), isNew: z.boolean() })),
  })
  .openapi('Claim');

export const City = z
  .object({
    id: z.string().openapi({ description: 'Stable catalogue id.', example: 'pl-warsaw' }),
    name: z.string().openapi({ example: 'Warsaw' }),
    country: z.string().length(2).openapi({ example: 'PL' }),
    center: LonLat,
    bounds: BoundingBox,
  })
  .openapi('City');

export const CityList = z.object({ items: z.array(City) }).openapi('CityList');

export const CitySearchQuery = z.object({
  q: z
    .string()
    .max(80)
    .optional()
    .openapi({
      param: { name: 'q', in: 'query' },
      description: 'Accent-insensitive; all cities when omitted.',
      example: 'krakow',
    }),
});

export const HomeCity = z.object({ city: City.nullable() }).openapi('HomeCity');

export const ChooseHomeCityBody = z
  .object({ cityId: z.string().openapi({ example: 'pl-krakow' }) })
  .openapi('ChooseHomeCityBody');
