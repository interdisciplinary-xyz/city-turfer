/**
 * The methods that change something: the CSRF guard checks a cookie request with one of them
 * (src/middleware.ts), and the spec documents `403 auth.csrf` on such routes (src/routes/define.ts).
 * One list, so the guard and the documented contract cannot disagree.
 */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Whether `method` (any case: Hono's `POST` or an OpenAPI route's `post`) changes something. */
export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}
