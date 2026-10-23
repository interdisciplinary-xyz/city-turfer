import { secretMatches } from './secret';

/**
 * The header the website's `/api/v1/*` route adds on Vercel (`apps/web/vercel.json`, a `routes`
 * transform with `op: "set"`, so a visitor's own value is replaced): `WEB_EDGE_SECRET`. It marks a
 * request that came through the website, the one hop whose forwarded IP we trust. Never logged.
 */
export const WEB_EDGE_HEADER = 'cityturfer-edge';

/** The shortest WEB_EDGE_SECRET accepted (`openssl rand -hex 32` gives 64). */
export const MIN_WEB_EDGE_SECRET_LENGTH = 32;

/** Whether the edge header carries WEB_EDGE_SECRET (constant time, `secretMatches`). */
export function edgeSecretMatches(value: string | undefined, secret: string | null): boolean {
  return secretMatches(value, secret);
}

/**
 * The caller's IP for the per-IP sign-in limits (never logged or stored); IdentityService buckets
 * it (IPv6 by /64). Vercel's request-headers docs promise only that it overwrites
 * `x-forwarded-for` ("to prevent IP spoofing"); they never say a client-sent
 * `x-vercel-forwarded-for` is stripped. So:
 * - **Direct callers** (phones, anyone calling the API host): the last `x-forwarded-for` entry
 *   (the one Vercel wrote; the only one if it overwrites), then `x-real-ip`.
 *   `x-vercel-forwarded-for` is ignored: a caller could set it to pick a fresh bucket per try.
 * - **Through the website** (the edge header matches WEB_EDGE_SECRET): `x-vercel-forwarded-for`
 *   first, which Vercel says survives a proxy in front (the website's hop), then the same fallbacks.
 * - Nothing (the local dev server): every caller shares the `unknown` bucket — fine locally.
 * Proven on a preview, docs/operations/api-deploy.md (website sessions, check 3).
 */
export function clientIp(header: (name: string) => string | undefined, edgeSecret: string | null): string {
  const first = (name: string) => header(name)?.split(',')[0]?.trim();
  const last = (name: string) => header(name)?.split(',').at(-1)?.trim();
  const viaWebsite = edgeSecretMatches(header(WEB_EDGE_HEADER), edgeSecret);
  return (
    (viaWebsite ? first('x-vercel-forwarded-for') : undefined) ||
    last('x-forwarded-for') ||
    first('x-real-ip') ||
    'unknown'
  );
}
