// Problem details (RFC 9457, apps/api/src/problem.ts) → what the portal shows. Only the stable
// `code` is read: `title` and `detail` are developer English and are never shown, and nothing the
// user typed is ever echoed back.
import type { ProblemCode } from './schema';

/**
 * The API codes the portal can meet and has its own message for (`portal.errors.<code>` in
 * messages/en.json and pl.json). Every other code, and any answer that is not a problem, shows
 * `portal.errors.generic` with the request id. `satisfies` pins the list to the generated contract.
 */
export const PORTAL_ERROR_CODES = [
  'invalid-request',
  'auth.invalid-code',
  'auth.rate-limited',
  'auth.csrf',
  'rate-limited',
  'consent.required',
  'not-found',
  'activity.deleted',
  'export.gone',
  'export.no-email',
  'storage.unavailable',
] as const satisfies readonly ProblemCode[];

type KnownCode = (typeof PORTAL_ERROR_CODES)[number];

/**
 * What the portal tells the user:
 * - a known API code;
 * - `signed-out`: any other 401 (session missing, expired or revoked): the client then clears
 *   everything and goes to sign-in;
 * - `unreachable`: no answer, or the gateway answered for the API (502/503/504 without a problem);
 * - `generic`: anything else (quote the request id).
 */
export type PortalErrorCode = KnownCode | 'signed-out' | 'unreachable' | 'generic';

const KNOWN = new Set<string>(PORTAL_ERROR_CODES);

/** Gateway answers that mean "the API is not there", when they carry no problem body. */
const UNREACHABLE_STATUSES = new Set([502, 503, 504]);

/** Codes worth retrying automatically (once or twice) for reads. */
const RETRYABLE = new Set<PortalErrorCode>(['unreachable', 'storage.unavailable']);

export class PortalError extends Error {
  readonly code: PortalErrorCode;
  /** HTTP status, or 0 when there was no answer. */
  readonly status: number;
  /** `X-Request-Id` of the answer, shown with the generic message so support can find the log line. */
  readonly requestId: string | null;
  /** Seconds from `Retry-After` on a 429 (or 503), else null. */
  readonly retryAfterSeconds: number | null;

  constructor(
    code: PortalErrorCode,
    {
      status = 0,
      requestId = null,
      retryAfterSeconds = null,
    }: Partial<Pick<PortalError, 'status' | 'requestId' | 'retryAfterSeconds'>> = {}
  ) {
    // The message is the code only: never a title, detail or input value.
    super(code);
    this.name = 'PortalError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** The message key inside the `portal` namespace, e.g. `errors.auth.invalid-code`. */
  get messageKey(): string {
    return `errors.${this.code}`;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }
}

export function isPortalError(value: unknown): value is PortalError {
  return value instanceof PortalError;
}

/** `Retry-After` as seconds: delta-seconds or an HTTP date; null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) {
    return null;
  }
  return Math.max(0, Math.ceil((at - now) / 1000));
}

function codeOf(body: unknown): string | null {
  if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') {
    return body.code;
  }
  return null;
}

/** Maps a non-2xx answer (and its parsed body, as openapi-fetch hands it over) to a PortalError. */
export function toPortalError(response: Response, body: unknown, now: number = Date.now()): PortalError {
  const status = response.status;
  const requestId = response.headers.get('X-Request-Id');
  const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'), now);
  const code = codeOf(body);
  const meta = { status, requestId, retryAfterSeconds };

  if (code !== null && KNOWN.has(code)) {
    return new PortalError(code as KnownCode, meta);
  }
  if (status === 401) {
    return new PortalError('signed-out', meta);
  }
  if (code === null && UNREACHABLE_STATUSES.has(status)) {
    return new PortalError('unreachable', meta);
  }
  return new PortalError('generic', meta);
}

/** fetch threw: offline, DNS, the rewrite target down, or the request was blocked. */
export function unreachableError(): PortalError {
  return new PortalError('unreachable');
}
