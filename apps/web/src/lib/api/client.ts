// The one API client of the portal: openapi-fetch over the generated contract. Only this folder
// calls the API. Same-origin requests to /api/v1/* (the vercel.json rewrite; server.mjs in dev),
// so the browser sends the HttpOnly session cookie by itself and JavaScript never sees a token.
import createClient, { type Client, type Middleware } from 'openapi-fetch';

import { toPortalError, unreachableError } from './errors';
import type { ApiPaths } from './schema';

/** Required on unsafe requests with the cookie (CSRF guard, apps/api/src/middleware.ts). */
export const CLIENT_HEADER = 'CityTurfer-Client';

/** The site's version, inlined at build time (next.config.ts `env`). */
export const WEB_VERSION = process.env.CITYTURFER_WEB_VERSION ?? '0.0.0';

/** The rewrite's prefix: `/api` + `/v1/...` from the spec. */
export const API_BASE_URL = '/api';

/**
 * Where a 401 is an answer, not a lost session: a wrong code on sign-in, and sign-out itself
 * (already signed out is fine).
 */
const NO_SESSION_PATHS = new Set(['/v1/auth/codes', '/v1/auth/sign-in', '/v1/auth/session']);

export type PortalClient = Client<ApiPaths>;

export type PortalClientOptions = {
  /**
   * Called on a 401 outside sign-in: clear everything in memory and go to sign-in. `code` is the
   * problem code: `auth.invalid` (the session ended) or `auth.missing` (never signed in here).
   */
  onUnauthorized: (code: string | null) => void;
  baseUrl?: string;
  /** Tests pass their own fetch. */
  fetch?: (input: Request) => Promise<Response>;
  version?: string;
};

export function createPortalClient({
  onUnauthorized,
  baseUrl = API_BASE_URL,
  fetch,
  version = WEB_VERSION,
}: PortalClientOptions): PortalClient {
  const client = createClient<ApiPaths>({
    baseUrl,
    credentials: 'same-origin',
    // Personal answers are `no-store` on the API too; never let the HTTP cache keep one.
    cache: 'no-store',
    ...(fetch ? { fetch } : {}),
  });
  const middleware: Middleware = {
    onRequest({ request }) {
      request.headers.set(CLIENT_HEADER, `web/${version}`);
      return request;
    },
    async onResponse({ response, schemaPath }) {
      if (response.status === 401 && !NO_SESSION_PATHS.has(schemaPath)) {
        const body: unknown = await response
          .clone()
          .json()
          .catch(() => null);
        const code =
          body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : null;
        onUnauthorized(code);
      }
      return undefined;
    },
  };
  client.use(middleware);
  return client;
}

/** What every openapi-fetch call resolves to. */
type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Awaits an openapi-fetch call and returns its data, or throws a PortalError: the problem `code`
 * mapped to a message, or `unreachable` when fetch itself failed.
 */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await call;
  } catch {
    throw unreachableError();
  }
  if (!result.response.ok) {
    throw toPortalError(result.response, result.error);
  }
  return result.data as T;
}
