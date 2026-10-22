import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie } from 'hono/cookie';

import { BackupService } from './backup/use-cases';
import type { AppEnv, Credential } from './deps';
import { problem } from './problem';
import { SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES } from './session-cookie';

/** Vercel Functions take request bodies up to 4.5 MB; refuse bigger ones before reading them. */
export const MAX_BODY_BYTES = 4_500_000;

/** A gzip body may inflate to at most this (zip-bomb guard); a 40,000-point track is ~2 MB. */
export const MAX_INFLATED_BYTES = 16_000_000;

/** Logs one line per request: route pattern, status, duration, request id. Never bodies or ids. */
export const logRequests: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = performance.now();
  await next();
  c.var.deps.log.request({
    requestId: c.var.requestId,
    method: c.req.method,
    route: c.req.routePath,
    status: c.res.status,
    ms: Math.round(performance.now() - start),
  });
};

const SAFE_NAME = /^[A-Za-z][\w.]{0,63}$/;
const SAFE_CODE = /^[A-Za-z0-9_.-]{1,40}$/;
/** `…/file.ts:12:34` in a stack frame (`at fn (path:line:col)` or `at path:line:col`). */
const FRAME = /^\s+at\s.*?([\w.-]+\.[cm]?[jt]s):(\d+):(\d+)\)?\s*$/;

/** A code that is a short identifier (`23505`, `ECONNRESET`), else nothing. */
function safeCode(value: unknown): string | undefined {
  const code = typeof value === 'number' ? String(value) : value;
  return typeof code === 'string' && SAFE_CODE.test(code) ? code : undefined;
}

/**
 * What the log may say about an unexpected error: its class name, a short code, the same for its
 * `cause` (Drizzle wraps the driver's error), and the file:line:column of the first stack frame in a
 * .js/.ts file —
 * **never the message**: database and validation messages quote the query parameters and input
 * (e-mails, coordinates, tokens). The frame keeps only the file's base name.
 */
export function describeError(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const e = err instanceof Error ? err : null;
  out.error = e && SAFE_NAME.test(e.name) ? e.name : 'Error';
  const code = safeCode((err as { code?: unknown } | null)?.code);
  if (code) {
    out.code = code;
  }
  const cause = e?.cause;
  if (cause instanceof Error) {
    out.cause = SAFE_NAME.test(cause.name) ? cause.name : 'Error';
    const causeCode = safeCode((cause as { code?: unknown }).code);
    if (causeCode) {
      out.causeCode = causeCode;
    }
  }
  // Frames only: the stack starts with `<name>: <message>` (the name at construction time), and the
  // message may span lines — read only what follows it, or nothing when it cannot be found.
  const full = e?.stack ?? '';
  const end = e?.message ? full.indexOf(e.message) : full.indexOf('\n');
  const stack = end < 0 ? '' : full.slice(end + (e?.message.length ?? 0));
  for (const line of stack.split('\n')) {
    const m = FRAME.exec(line);
    if (m) {
      out.at = `${m[1]}:${m[2]}:${m[3]}`;
      break;
    }
  }
  return out;
}

/** 413 `payload-too-large` past MAX_BODY_BYTES (Content-Length or streamed). */
export const limitBody: MiddlewareHandler<AppEnv> = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: (c) => problem(c, 'payload-too-large', 'Bodies are limited to 4.5 MB: gzip the upload.'),
});

/**
 * Inflates `Content-Encoding: gzip` bodies (neither Hono nor Vercel does), capped at
 * MAX_INFLATED_BYTES. Other encodings get 415.
 */
export const inflateGzip: MiddlewareHandler<AppEnv> = async (c, next) => {
  const encoding = c.req.header('content-encoding')?.trim().toLowerCase();
  if (!encoding || encoding === 'identity') {
    return next();
  }
  if (encoding !== 'gzip') {
    return problem(c, 'unsupported-media-type', 'Content-Encoding must be gzip or absent.');
  }
  const raw = c.req.raw;
  if (!raw.body) {
    return next();
  }
  const reader = raw.body.pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > MAX_INFLATED_BYTES) {
        await reader.cancel();
        return problem(c, 'payload-too-large', 'The inflated body is too large: split the upload.');
      }
      chunks.push(value);
    }
  } catch {
    return problem(c, 'invalid-request', 'The body is not valid gzip.');
  }
  const headers = new Headers(raw.headers);
  headers.delete('content-encoding');
  headers.set('content-length', String(size));
  c.req.raw = new Request(raw.url, { method: raw.method, headers, body: new Blob(chunks as BlobPart[]) });
  return next();
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** `CityTurfer-Client` of the website: `web/<version>` (e.g. `web/0.10.0`). */
const WEB_CLIENT = /^web\/[0-9A-Za-z.+-]{1,32}$/;

/**
 * The CSRF guard for browser requests that change something (and for the browser sign-in): the
 * cookie is `SameSite=Strict`, and on top `Origin` must be the website (`WEB_ORIGIN`),
 * `Sec-Fetch-Site`, when sent, `same-origin`, and `CityTurfer-Client: web/<version>` present (a
 * cross-site form cannot set a header). Bearer requests never need it: a page cannot attach one.
 */
export function isFromWebsite(c: Context<AppEnv>): boolean {
  const { webOrigin } = c.var.deps;
  if (!webOrigin || c.req.header('origin') !== webOrigin) {
    return false;
  }
  const site = c.req.header('sec-fetch-site');
  if (site !== undefined && site !== 'same-origin') {
    return false;
  }
  return WEB_CLIENT.test(c.req.header('cityturfer-client')?.trim() ?? '');
}

/** Tells the browser to drop the session cookie (`Max-Age=0`, the same attributes). */
export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES);
}

/**
 * Route middleware for every protected route: runs **before** validation, so a request without a
 * valid credential gets 401 and learns nothing about the schema. The credential is
 * `Authorization: Bearer …` (phones, device tokens; wins when both are sent) or the
 * `__Secure-ct_session` cookie (browsers; then the CSRF guard for unsafe methods). Only principals
 * of the `user` realm pass.
 */
export const requireCaller: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization');
  const bearer = header ? /^Bearer\s+(\S+)$/i.exec(header)?.[1] : undefined;
  const cookie = header ? undefined : getCookie(c, SESSION_COOKIE) || undefined;
  if (!bearer && !cookie) {
    return problem(c, 'auth.missing', 'Send Authorization: Bearer <token>, or sign in on the website.', {
      headers: { 'WWW-Authenticate': 'Bearer' },
    });
  }
  const credential: Credential = bearer ? 'bearer' : 'cookie';
  if (credential === 'cookie' && UNSAFE_METHODS.has(c.req.method) && !isFromWebsite(c)) {
    return problem(c, 'auth.csrf', "Changes with the session cookie need the website's Origin and client header.");
  }
  let principal;
  try {
    principal = await c.var.deps.auth.verify((bearer ?? cookie)!, credential);
  } catch {
    // Session tokens are checked in the database: when it does not answer, say so (not 401).
    return problem(c, 'storage.unavailable', 'The database did not answer: retry later.');
  }
  if (!principal || principal.realm !== 'user') {
    if (credential === 'cookie') {
      clearSessionCookie(c);
    }
    return problem(c, 'auth.invalid', undefined, {
      headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
    });
  }
  c.set('principal', { ...principal, credential });
  return next();
};

/**
 * Personal answers are never cached, by the browser (shared computers, the back button) or an edge
 * (the website's `/api/v1/*` rewrite): `Cache-Control: private, no-store` unless the route set its
 * own (tracks keep `private, no-cache` + ETag), and always `Vary: Cookie, Authorization`.
 */
export const personalCaching: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  const headers = c.res.headers;
  if (!headers.has('cache-control')) {
    headers.set('Cache-Control', 'private, no-store');
  }
  const vary = (headers.get('vary') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  for (const name of ['Cookie', 'Authorization']) {
    if (!vary.some((v) => v.toLowerCase() === name.toLowerCase() || v === '*')) {
      vary.push(name);
    }
  }
  headers.set('Vary', vary.join(', '));
};

/** Users already upserted by this function instance (one write per user per cold start). */
const knownUsers = new WeakMap<object, Set<string>>();

/** After an erasure: the next request of this user (a device token) creates the row again. */
export function forgetUser(store: object, userId: string): void {
  knownUsers.get(store)?.delete(userId);
}

/**
 * Route middleware for live data routes, after `requireCaller`: a verified principal (else 401),
 * a configured database (else 503 `storage.unavailable`), and the user row (created on first sight).
 */
export const requireStore: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { principal, deps } = c.var;
  if (!principal.verified || !principal.userId) {
    return problem(c, 'auth.invalid', undefined, {
      headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
    });
  }
  const { store } = deps;
  if (!store) {
    return problem(c, 'storage.unavailable', 'No database is configured.');
  }
  const userId = principal.userId;
  const seen = knownUsers.get(store) ?? new Set<string>();
  knownUsers.set(store, seen);
  if (!seen.has(userId)) {
    try {
      await store.ensureUser({
        id: userId,
        email: principal.profile?.email ?? null,
        displayName: principal.profile?.displayName ?? null,
      });
    } catch {
      return problem(c, 'storage.unavailable', 'The database did not answer: retry later.');
    }
    seen.add(userId);
  }
  c.set('userId', userId);
  c.set('backup', new BackupService(store, deps.clock));
  return next();
};
