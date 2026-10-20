import { z } from '@hono/zod-openapi';

/**
 * Shared pieces of the /v1 contract (`api-design` skill). Examples use public landmarks (Warsaw Old
 * Town) and made-up ids, never real user data.
 */

/** Error body for every non-2xx answer: RFC 9457 problem details plus our stable `code`. */
export const Problem = z
  .object({
    type: z.string().openapi({ example: 'https://cityturfer.app/problems/not-implemented' }),
    title: z.string().openapi({ example: 'Not implemented yet' }),
    status: z.number().int().openapi({ example: 501 }),
    detail: z.string().optional().openapi({ example: 'Planned in docs/decisions/api-2026-10-20.md.' }),
    code: z
      .string()
      .openapi({ description: "Stable machine code, e.g. a DomainError's code.", example: 'not-implemented' }),
  })
  .openapi('Problem');

export const PROBLEM_CONTENT = { 'application/problem+json': { schema: Problem } } as const;

export const problemResponse = (description: string) => ({ description, content: PROBLEM_CONTENT });

/** ISO 8601 UTC timestamp. */
export const IsoDateTime = z.string().datetime().openapi({ example: '2026-10-19T07:12:00Z' });

/** IANA time zone, needed for local-time rules (activity names, week start, achievements). */
export const TimeZone = z.string().min(1).openapi({ example: 'Europe/Warsaw' });

/** GeoJSON order: [longitude, latitude]. */
export const LonLat = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .openapi('LonLat', { example: [21.0122, 52.2297] });

/** [west, south, east, north], as MapLibre and the app's BoundingBox. */
export const BoundingBox = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .openapi('BoundingBox', { example: [20.85, 52.12, 21.17, 52.34] });

export const ActivityType = z.enum(['walk', 'run', 'cycle']).openapi('ActivityType', { example: 'run' });

/** Ids are minted by the phone (session UUID, `hk-…` for Apple Health imports) and never re-minted. */
export const ActivityId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/)
  .openapi({ example: '3f9c2a64-5d1e-4b8e-9a51-0c7d2e6f1b20' });

export const ActivityIdParam = z.object({
  activityId: ActivityId.openapi({ param: { name: 'activityId', in: 'path' } }),
});

/** Bearer token from `POST /v1/auth/sign-in`. */
export const BEARER_AUTH = [{ bearerAuth: [] }];

/** Responses every authenticated route can give. */
export const AUTH_ERRORS = {
  401: problemResponse('Missing or invalid bearer token.'),
} as const;

/** Spec extension marking routes that are declared but not built yet. */
export const PLANNED = { 'x-cityturfer-status': 'planned' } as const;

export const NOT_IMPLEMENTED = { 501: problemResponse('Planned route, not implemented yet.') } as const;
