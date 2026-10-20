import type { Context } from 'hono';

/** RFC 9457 problem details answered as `application/problem+json` (`api-design` skill). */
export function problem(c: Context, status: number, code: string, title: string, detail?: string): Response {
  const body = { type: `https://cityturfer.app/problems/${code}`, title, status, code, ...(detail ? { detail } : {}) };
  return c.body(JSON.stringify(body), status as never, { 'Content-Type': 'application/problem+json' });
}
