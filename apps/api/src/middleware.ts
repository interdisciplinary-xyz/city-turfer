import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { BackupService } from './backup/use-cases';
import type { AppEnv } from './deps';
import { problem } from './problem';

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

/**
 * Route middleware for every protected route: runs **before** validation, so a request without a
 * valid token gets 401 and learns nothing about the schema.
 */
export const requireBearer: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) {
    return problem(c, 'auth.missing', 'Send Authorization: Bearer <token>.', {
      headers: { 'WWW-Authenticate': 'Bearer' },
    });
  }
  const principal = await c.var.deps.auth.verify(match[1]);
  if (!principal) {
    return problem(c, 'auth.invalid', undefined, {
      headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
    });
  }
  c.set('principal', principal);
  return next();
};

/** Users already upserted by this function instance (one write per user per cold start). */
const knownUsers = new WeakMap<object, Set<string>>();

/**
 * Route middleware for live data routes, after `requireBearer`: a verified principal (else 401),
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
