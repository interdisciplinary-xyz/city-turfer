export type RequestLogStatus = number | 'pending' | 'failed';

/** Where the request was made from: the browser, or the Node server. */
export type RequestLogSource = 'browser' | 'server';

export type RequestLogEntry = {
  /** `b<n>` for browser entries, `s<n>` for server ones — unique across both. */
  id: string;
  source: RequestLogSource;
  method: string;
  /** Path + query for same-origin requests, `host/path` otherwise. */
  url: string;
  /** Pathname of the page that caused the request (`null` = background work). */
  page: string | null;
  /**
   * Server only: the incoming route that made the request — the page itself
   * for an SSR fetch, or e.g. `/api/how-to-say` for an API route's OpenAI call.
   */
  via: string | null;
  status: RequestLogStatus;
  /** Wall-clock start (ms epoch). Browser and server share the machine clock. */
  startedAt: number;
  durationMs: number | null;
  /**
   * Response body size in bytes. Browser: the decoded body as read. Server:
   * `Content-Length` when the response declares one, else `null`.
   */
  sizeBytes: number | null;
};

export type ServerRequestLogResponse = {
  entries: Array<Omit<RequestLogEntry, 'id' | 'source'> & { id: number }>;
  lastId: number;
};

export type RequestLogState = {
  entries: readonly RequestLogEntry[];
  listeners: Set<() => void>;
  nextId: number;
  installed: boolean;
};

/** Oldest entries are dropped past this, so a long session can't grow unbounded. */
export const REQUEST_LOG_LIMIT = 500;

/**
 * Global key for the log state. On `window` rather than module scope so an
 * HMR re-evaluation of this module keeps talking to the SAME state the
 * already-patched `fetch` writes to.
 */
export const REQUEST_LOG_GLOBAL_KEY = Symbol.for('interdisciplinary.dev-toolbar.requestLog');

export const EMPTY_REQUEST_LOG: readonly RequestLogEntry[] = [];

export const SERVER_REQUEST_LOG_POLL_MS = 1500;
