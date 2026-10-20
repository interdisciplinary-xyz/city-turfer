import type { Context } from 'hono';

import { PROBLEM_CODES, type ProblemCode } from './errors';

/** One invalid field of a 400: a JSON pointer into the request and a short reason, never the value. */
export interface FieldError {
  pointer: string;
  code: string;
}

/**
 * RFC 9457 problem details answered as `application/problem+json` (`api-design` skill). Status and
 * title come from the code catalogue (`errors.ts`). `detail` must never hold coordinates or other
 * input values.
 */
export function problem(
  c: Context,
  code: ProblemCode,
  detail?: string,
  extra: { errors?: FieldError[]; headers?: Record<string, string> } = {}
): Response {
  const { status, title } = PROBLEM_CODES[code];
  const body = {
    type: `https://cityturfer.app/problems/${code}`,
    title,
    status,
    code,
    ...(detail ? { detail } : {}),
    ...(extra.errors ? { errors: extra.errors } : {}),
  };
  return c.body(JSON.stringify(body), status as never, {
    ...extra.headers,
    'Content-Type': 'application/problem+json',
  });
}
