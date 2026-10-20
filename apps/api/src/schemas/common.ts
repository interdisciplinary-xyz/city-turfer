import { type OpenAPIHono, z } from '@hono/zod-openapi';

import { PROBLEM_CODE_LIST, PROBLEM_CODES, type ProblemCode } from '../errors';

/**
 * Shared pieces of the /v1 contract (`api-design` skill, docs/decisions/api-sync-2026-10-20.md).
 * Examples use public landmarks (Warsaw Old Town) and made-up ids, never real user data.
 */

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

export const ProblemCodeSchema = z
  .enum(PROBLEM_CODE_LIST)
  .openapi('ProblemCode', { description: 'Stable machine code (catalogue in the API description, "Errors").' });

export const FieldError = z
  .object({
    pointer: z.string().openapi({ description: 'JSON pointer into the request.', example: '/track/points/3/0' }),
    code: z.string().openapi({ description: 'Why it is invalid (zod issue code).', example: 'too_big' }),
  })
  .openapi('FieldError');

/** Error body for every non-2xx answer: RFC 9457 problem details plus our stable `code`. */
export const Problem = z
  .object({
    type: z.string().openapi({ example: 'https://cityturfer.app/problems/not-found' }),
    title: z.string().openapi({ example: 'Not found' }),
    status: z.number().int().openapi({ example: 404 }),
    detail: z.string().optional().openapi({ description: 'For people; never holds input values or coordinates.' }),
    code: ProblemCodeSchema,
    errors: z
      .array(FieldError)
      .optional()
      .openapi({ description: 'Only on 400 `invalid-request`: which fields are invalid.' }),
  })
  .openapi('Problem');

const problemExample = (code: ProblemCode) => {
  const { status, title } = PROBLEM_CODES[code];
  return { summary: code, value: { type: `https://cityturfer.app/problems/${code}`, title, status, code } };
};

/** A problem+json response that can carry these catalogue codes (shown as examples in Swagger). */
export const problemResponse = (description: string, ...codes: ProblemCode[]) => ({
  description: codes.length > 0 ? `${description} Codes: ${codes.map((c) => `\`${c}\``).join(', ')}.` : description,
  content: {
    'application/problem+json': {
      schema: Problem,
      ...(codes.length > 0 ? { examples: Object.fromEntries(codes.map((c) => [c, problemExample(c)])) } : {}),
    },
  },
});

/** 400 for routes with a query, params or body. */
export const INVALID = { 400: problemResponse('Invalid input.', 'invalid-request') } as const;

/** Responses every authenticated route can give (auth runs before validation). */
export const AUTH_ERRORS = {
  401: problemResponse('Missing or invalid bearer token; checked before the input.', 'auth.missing', 'auth.invalid'),
  429: {
    ...problemResponse('Too many requests: wait `Retry-After` seconds.', 'rate-limited'),
    headers: {
      'Retry-After': { $ref: '#/components/headers/RetryAfter' },
      RateLimit: { $ref: '#/components/headers/RateLimit' },
      'RateLimit-Policy': { $ref: '#/components/headers/RateLimitPolicy' },
    },
  },
} as const;

export const notFound = (what: string) => ({
  404: problemResponse(`No ${what} with this id for this user.`, 'not-found'),
});

/** Bearer token from `POST /v1/auth/sign-in` (Better Auth later). */
export const BEARER_AUTH = [{ bearerAuth: [] }];

/** Spec extension marking routes that are declared but not built yet. */
export const PLANNED = { 'x-cityturfer-status': 'planned' } as const;

export const NOT_IMPLEMENTED = {
  501: problemResponse('Planned route, not implemented yet.', 'not-implemented'),
} as const;

// ---------------------------------------------------------------------------------------------
// Headers and parameters
// ---------------------------------------------------------------------------------------------

export const ETAG_HEADER = { ETag: { $ref: '#/components/headers/ETag' } } as const;
export const LOCATION_HEADER = { Location: { $ref: '#/components/headers/Location' } } as const;

/** Reusable response headers, registered once in `components.headers`. */
export function registerHeaders(registry: OpenAPIHono['openAPIRegistry']): void {
  const header = (name: string, description: string, example: string | number) =>
    registry.registerComponent('headers', name, {
      description,
      schema: { type: typeof example === 'number' ? 'integer' : 'string', example },
    });
  header('ETag', 'Version of the resource; send it back in `If-Match` to change it.', '"v3"');
  header('Location', 'Where the created resource or job lives.', '/v1/me/exports/exp_01');
  header('RetryAfter', 'Seconds to wait before retrying.', 30);
  header(
    'RateLimit',
    'Remaining quota of the current window (IETF RateLimit header).',
    'limit=600, remaining=12, reset=30'
  );
  header('RateLimitPolicy', 'The quota policy (IETF RateLimit-Policy header).', '600;w=3600');
}

export const IfMatch = z
  .string()
  .max(64)
  .optional()
  .openapi({
    param: { name: 'If-Match', in: 'header' },
    description: 'The `ETag` you last saw. Required to replace an existing resource with different content.',
    example: '"v3"',
  });

export const Limit = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .default(50)
  .openapi({ param: { name: 'limit', in: 'query' }, example: 50 });

export const Cursor = z
  .string()
  .min(1)
  .max(512)
  .optional()
  .openapi({
    param: { name: 'cursor', in: 'query' },
    description: 'Opaque: pass `nextCursor` of the previous page. Omit for the first page.',
    example: 'eyJzIjoxMjh9',
  });

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

/** ISO 8601 UTC timestamp. */
export const IsoDateTime = z.iso.datetime().openapi({ example: '2026-10-19T07:12:00Z' });

/** IANA time zone (display only: the server derives nothing from local time). */
export const TimeZone = z.string().min(1).max(64).openapi({ example: 'Europe/Warsaw' });

/** GeoJSON order: [longitude, latitude]. */
export const LonLat = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .openapi('LonLat', { description: '[longitude, latitude] (GeoJSON order).', example: [21.0122, 52.2297] });

/** [west, south, east, north], as MapLibre and the app's BoundingBox. */
export const BoundingBox = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .openapi('BoundingBox', { description: '[west, south, east, north].', example: [20.85, 52.12, 21.17, 52.34] });

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
