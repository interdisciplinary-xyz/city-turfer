import { DEV_REQUEST_LOG_PATH } from '../../../protocol.js';
import { isDevToolingEnabled } from '../is-dev-tooling-enabled';
import { shouldLogRequest } from '../should-log-request';
import {
  EMPTY_REQUEST_LOG,
  REQUEST_LOG_GLOBAL_KEY,
  REQUEST_LOG_LIMIT,
  type RequestLogEntry,
  type RequestLogState,
  SERVER_REQUEST_LOG_POLL_MS,
  type ServerRequestLogResponse,
} from './request-log.constants';

const getState = (): RequestLogState => {
  const holder = window as unknown as Record<symbol, RequestLogState>;
  holder[REQUEST_LOG_GLOBAL_KEY] ??= {
    entries: EMPTY_REQUEST_LOG,
    listeners: new Set(),
    nextId: 1,
    installed: false,
  };
  return holder[REQUEST_LOG_GLOBAL_KEY];
};

// Deferred: a request can start during another component's render, and
// notifying useSyncExternalStore subscribers synchronously there would
// trigger React's "update while rendering a different component" warning.
const emit = (state: RequestLogState) => {
  queueMicrotask(() => {
    state.listeners.forEach((listener) => listener());
  });
};

const setEntries = (state: RequestLogState, entries: readonly RequestLogEntry[]) => {
  state.entries = entries.slice(-REQUEST_LOG_LIMIT);
  emit(state);
};

const toUrl = (raw: string): URL | null => {
  try {
    return new URL(raw, window.location.href);
  } catch {
    return null;
  }
};

const displayUrl = (url: URL) =>
  url.origin === window.location.origin ? `${url.pathname}${url.search}` : `${url.host}${url.pathname}${url.search}`;

type Handle = { id: string; t0: number };

const startEntry = (method: string, url: URL): Handle => {
  const state = getState();
  const entry: RequestLogEntry = {
    id: `b${state.nextId++}`,
    source: 'browser',
    method: method.toUpperCase(),
    url: displayUrl(url),
    page: window.location.pathname,
    via: null,
    status: 'pending',
    startedAt: Date.now(),
    durationMs: null,
    sizeBytes: null,
  };
  setEntries(state, [...state.entries, entry]);
  return { id: entry.id, t0: performance.now() };
};

const updateEntry = (id: string, patch: Partial<RequestLogEntry>) => {
  const state = getState();
  setEntries(
    state,
    state.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
  );
};

const finishEntry = ({ id, t0 }: Handle, patch: Pick<RequestLogEntry, 'status'> & Partial<RequestLogEntry>) => {
  updateEntry(id, { ...patch, durationMs: Math.round(performance.now() - t0) });
};

/**
 * Measure a fetch response body without consuming it: read a clone. Skipped
 * for event streams, whose clone would never finish.
 */
const measureFetchBody = (id: string, response: Response) => {
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    return;
  }
  response
    .clone()
    .arrayBuffer()
    .then((body) => updateEntry(id, { sizeBytes: body.byteLength }))
    .catch(() => {
      // Aborted / opaque — size stays unknown.
    });
};

const measureXhrBody = (xhr: XMLHttpRequest): number | null => {
  try {
    const { response } = xhr;
    if (response instanceof ArrayBuffer) {
      return response.byteLength;
    }
    if (response instanceof Blob) {
      return response.size;
    }
    if (typeof response === 'string') {
      return new Blob([response]).size;
    }
    if (response != null) {
      return new Blob([JSON.stringify(response)]).size;
    }
  } catch {
    // Unreadable response type — size stays unknown.
  }
  return null;
};

const patchFetch = (originalFetch: typeof window.fetch) => {
  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = toUrl(rawUrl);
    if (!url || !shouldLogRequest(url)) {
      return originalFetch(input, init);
    }
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const handle = startEntry(method, url);
    try {
      const response = await originalFetch(input, init);
      finishEntry(handle, { status: response.status });
      measureFetchBody(handle.id, response);
      return response;
    } catch (error) {
      finishEntry(handle, { status: 'failed' });
      throw error;
    }
  };
};

const patchXhr = () => {
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const pending = new WeakMap<XMLHttpRequest, { method: string; url: URL }>();

  proto.open = function (this: XMLHttpRequest, ...args: Parameters<XMLHttpRequest['open']>) {
    const [method, rawUrl] = args;
    const url = toUrl(String(rawUrl));
    if (url && shouldLogRequest(url)) {
      pending.set(this, { method, url });
    } else {
      pending.delete(this);
    }
    return Reflect.apply(originalOpen, this, args);
  } as XMLHttpRequest['open'];

  proto.send = function (this: XMLHttpRequest, ...args: Parameters<XMLHttpRequest['send']>) {
    const meta = pending.get(this);
    if (meta) {
      const handle = startEntry(meta.method, meta.url);
      this.addEventListener(
        'loadend',
        () =>
          finishEntry(handle, {
            status: this.status || 'failed',
            sizeBytes: measureXhrBody(this),
          }),
        { once: true }
      );
    }
    return Reflect.apply(originalSend, this, args);
  };
};

/**
 * Poll the dev server for its own outgoing requests and merge them in.
 * Uses the UNPATCHED fetch so the poll never logs itself. Starts from this
 * document's navigation time, so the SSR requests that produced the current
 * page are included but earlier page loads are not. Stops for good on a
 * non-OK answer (e.g. `next dev` without the custom server.js).
 */
const pollServerLog = (originalFetch: typeof window.fetch) => {
  const after = Math.floor(performance.timeOrigin) - 1000;
  let since = 0;

  const tick = async () => {
    let body: ServerRequestLogResponse;
    try {
      const response = await originalFetch(`${DEV_REQUEST_LOG_PATH}?after=${after}&since=${since}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        return;
      }
      body = (await response.json()) as ServerRequestLogResponse;
    } catch {
      // Dev server restarting — try again next tick.
      setTimeout(tick, SERVER_REQUEST_LOG_POLL_MS);
      return;
    }

    if (body.entries.length > 0) {
      const state = getState();
      const incoming = new Map(
        body.entries.map((entry) => [`s${entry.id}`, { ...entry, id: `s${entry.id}`, source: 'server' as const }])
      );
      const merged = state.entries.map((entry) => {
        const update = incoming.get(entry.id);
        if (update) {
          incoming.delete(entry.id);
          return update;
        }
        return entry;
      });
      setEntries(state, [...merged, ...incoming.values()]);
    }

    // Re-request still-pending entries until they settle.
    const firstPending = body.entries.find((e) => e.status === 'pending');
    since = firstPending ? firstPending.id - 1 : body.lastId;
    setTimeout(tick, SERVER_REQUEST_LOG_POLL_MS);
  };

  void tick();
};

/**
 * Patch `fetch` + `XMLHttpRequest` to record browser requests, and start
 * polling the dev server for server-side ones. Idempotent, and a no-op
 * outside `NODE_ENV=development` on a local hostname, so it can be called
 * unconditionally at module load (which is the point: it must be installed
 * before the page's own effects fire their first requests).
 */
export function installRequestLog(): void {
  if (!isDevToolingEnabled()) {
    return;
  }
  const state = getState();
  if (state.installed) {
    return;
  }
  state.installed = true;
  const originalFetch = window.fetch.bind(window);
  patchFetch(originalFetch);
  patchXhr();
  pollServerLog(originalFetch);
}

export function subscribeRequestLog(listener: () => void): () => void {
  const { listeners } = getState();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getRequestLogSnapshot = (): readonly RequestLogEntry[] => getState().entries;

export const getRequestLogServerSnapshot = (): readonly RequestLogEntry[] => EMPTY_REQUEST_LOG;

/** Clears the view. Server entries already fetched are not re-sent. */
export function clearRequestLog(): void {
  setEntries(getState(), EMPTY_REQUEST_LOG);
}
