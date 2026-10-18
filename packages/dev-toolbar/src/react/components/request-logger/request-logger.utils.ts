import { getDevToolbarConfig } from '../../utils/dev-toolbar-config';
import type { RequestLogEntry, RequestLogStatus } from '../../utils/request-log';
import {
  DEFAULT_REQUEST_LOGGER_PREFS,
  type RequestLoggerPrefs,
  type RequestLogScope,
  type RequestLogSourceFilter,
  type RequestLogSummary,
} from './request-logger.constants';

export const isErrorStatus = (status: RequestLogStatus): boolean =>
  status === 'failed' || (typeof status === 'number' && status >= 400);

/** Entries in scope + source, oldest first (browser and server interleaved). */
export const filterRequestLog = (
  entries: readonly RequestLogEntry[],
  scope: RequestLogScope,
  pathname: string,
  source: RequestLogSourceFilter = 'all'
): RequestLogEntry[] =>
  entries
    .filter((e) => (scope === 'all' || e.page === pathname) && (source === 'all' || e.source === source))
    .sort((a, b) => a.startedAt - b.startedAt);

export const duplicateKey = (entry: RequestLogEntry): string => `${entry.source} ${entry.method} ${entry.url}`;

/** How many times each method + URL + source occurs in `entries`. */
export const countDuplicates = (entries: readonly RequestLogEntry[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = duplicateKey(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

export const summarizeRequestLog = (entries: readonly RequestLogEntry[]): RequestLogSummary => {
  let totalBytes = 0;
  let unknownSize = 0;
  let slowestMs: number | null = null;
  let errors = 0;
  for (const entry of entries) {
    if (entry.sizeBytes === null) {
      unknownSize += 1;
    } else {
      totalBytes += entry.sizeBytes;
    }
    if (entry.durationMs !== null) {
      slowestMs = Math.max(slowestMs ?? 0, entry.durationMs);
    }
    if (isErrorStatus(entry.status)) {
      errors += 1;
    }
  }
  const unique = countDuplicates(entries).size;
  return {
    count: entries.length,
    errors,
    duplicates: entries.length - unique,
    totalBytes,
    unknownSize,
    slowestMs,
  };
};

export const statusClassName = (status: RequestLogStatus): string => {
  if (status === 'pending') {
    return 'text-white/40';
  }
  if (isErrorStatus(status)) {
    return 'text-red-400';
  }
  if (typeof status === 'number' && status >= 300) {
    return 'text-amber-300';
  }
  return 'text-emerald-400';
};

/** Flags payloads worth a second look when optimising. */
export const sizeClassName = (sizeBytes: number | null): string => {
  if (sizeBytes === null) {
    return 'text-white/30';
  }
  if (sizeBytes >= 100 * 1024) {
    return 'text-red-400';
  }
  if (sizeBytes >= 20 * 1024) {
    return 'text-amber-300';
  }
  return 'text-white/60';
};

export const formatStatus = (status: RequestLogStatus): string =>
  status === 'pending' ? '…' : status === 'failed' ? 'ERR' : String(status);

export const formatDuration = (durationMs: number | null): string => (durationMs === null ? '' : `${durationMs} ms`);

export const formatBytes = (bytes: number | null): string => {
  if (bytes === null) {
    return '?';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const formatClock = (epochMs: number): string => new Date(epochMs).toLocaleTimeString([], { hour12: false });

export const readRequestLoggerPrefs = (): RequestLoggerPrefs => {
  try {
    const raw = localStorage.getItem(getDevToolbarConfig().storageKeys.local.TOOLBAR_LOGGER);
    const parsed = raw ? (JSON.parse(raw) as Partial<RequestLoggerPrefs>) : {};
    return {
      view: parsed.view === 'routes' || parsed.view === 'live' ? parsed.view : DEFAULT_REQUEST_LOGGER_PREFS.view,
      listOpen: typeof parsed.listOpen === 'boolean' ? parsed.listOpen : DEFAULT_REQUEST_LOGGER_PREFS.listOpen,
    };
  } catch {
    return DEFAULT_REQUEST_LOGGER_PREFS;
  }
};

export const writeRequestLoggerPrefs = (prefs: RequestLoggerPrefs): void => {
  try {
    localStorage.setItem(getDevToolbarConfig().storageKeys.local.TOOLBAR_LOGGER, JSON.stringify(prefs));
  } catch {
    // Blocked storage — prefs just won't persist.
  }
};
