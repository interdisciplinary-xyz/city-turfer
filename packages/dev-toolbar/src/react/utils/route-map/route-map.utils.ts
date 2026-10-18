import type { RequestLogEntry } from '../request-log/request-log.constants';
import { normalizeRoutePath } from '../route-inventory';
import { ROUTE_MAP_VERSION, type RouteMap, type RouteMapPath, type RouteMapRequest } from './route-map.constants';

/**
 * Whether a request-log `page` names a web page. Background work (`null`),
 * framework endpoints and API routes hit directly are not routes to map.
 */
export const isPagePath = (page: string | null): page is string =>
  page !== null && !page.startsWith('/_next/') && !page.startsWith('/api/');

export const createRouteMap = (now: number): RouteMap => ({
  version: ROUTE_MAP_VERSION,
  startedAt: now,
  paths: {},
  aliases: {},
  redirects: {},
});

/** The path data for `path` is recorded under (itself, or its alias target). */
export const resolveRoutePath = (map: RouteMap, path: string): string => {
  const normalized = normalizeRoutePath(path);
  return map.aliases[normalized] ?? normalized;
};

/** Restore a stored run; anything unreadable or from another version starts fresh. */
export function parseRouteMap(raw: string | null, now: number): RouteMap {
  if (!raw) {
    return createRouteMap(now);
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RouteMap>;
    if (
      parsed.version === ROUTE_MAP_VERSION &&
      typeof parsed.startedAt === 'number' &&
      parsed.paths &&
      typeof parsed.paths === 'object'
    ) {
      // Runs saved before aliases/redirects existed.
      return {
        ...(parsed as RouteMap),
        aliases: parsed.aliases ?? {},
        redirects: parsed.redirects ?? {},
      };
    }
  } catch {
    // fall through
  }
  return createRouteMap(now);
}

const emptyPath = (path: string, now: number): RouteMapPath => ({
  path,
  visits: 0,
  firstSeenAt: now,
  lastVisitedAt: null,
  requests: {},
});

export function withVisit(map: RouteMap, rawPath: string, now: number): RouteMap {
  const path = resolveRoutePath(map, rawPath);
  const current = map.paths[path] ?? emptyPath(path, now);
  return {
    ...map,
    paths: {
      ...map.paths,
      [path]: { ...current, visits: current.visits + 1, lastVisitedAt: now },
    },
  };
}

/**
 * Fold settled request-log entries into the map, skipping ids already
 * recorded and anything not tied to a web page (see `isPagePath`). Returns the new map and the ids
 * it consumed; `map` is returned as-is when nothing changed.
 */
export function withRequests(
  map: RouteMap,
  entries: readonly RequestLogEntry[],
  recordedIds: ReadonlySet<string>,
  now: number
): { map: RouteMap; consumed: string[] } {
  const consumed: string[] = [];
  let paths = map.paths;

  for (const entry of entries) {
    if (entry.status === 'pending' || !isPagePath(entry.page) || recordedIds.has(entry.id)) {
      continue;
    }
    consumed.push(entry.id);
    const path = resolveRoutePath(map, entry.page);
    const current = paths[path] ?? emptyPath(path, now);
    const key = `${entry.source} ${entry.method} ${entry.url}`;
    const previous = current.requests[key];
    const maxOf = (a: number | null | undefined, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));

    paths = {
      ...paths,
      [path]: {
        ...current,
        requests: {
          ...current.requests,
          [key]: {
            key,
            source: entry.source,
            method: entry.method,
            url: entry.url,
            via: entry.via,
            count: (previous?.count ?? 0) + 1,
            lastStatus: entry.status,
            sizeBytes: maxOf(previous?.sizeBytes, entry.sizeBytes),
            maxDurationMs: maxOf(previous?.maxDurationMs, entry.durationMs),
          },
        },
      },
    };
  }

  return consumed.length ? { map: { ...map, paths }, consumed } : { map, consumed };
}

const maxOrNull = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

const mergeRequests = (
  into: Record<string, RouteMapRequest>,
  from: Record<string, RouteMapRequest>
): Record<string, RouteMapRequest> => {
  const merged = { ...into };
  for (const [key, request] of Object.entries(from)) {
    const existing = merged[key];
    merged[key] = existing
      ? {
          ...request,
          count: existing.count + request.count,
          sizeBytes: maxOrNull(existing.sizeBytes, request.sizeBytes),
          maxDurationMs: maxOrNull(existing.maxDurationMs, request.maxDurationMs),
        }
      : request;
  }
  return merged;
};

/**
 * `landed` is the same page as the route `target` under another URL (a
 * slug-translated redirect): fold everything already recorded for `landed`
 * into `target`, and route future visits/requests there.
 */
export function withAlias(map: RouteMap, landedPath: string, targetPath: string, now: number): RouteMap {
  const landed = normalizeRoutePath(landedPath);
  const target = normalizeRoutePath(targetPath);
  if (landed === target) {
    return map;
  }
  const { [landed]: moved, ...paths } = map.paths;
  const current = paths[target] ?? emptyPath(target, now);
  return {
    ...map,
    aliases: { ...map.aliases, [landed]: target },
    paths: {
      ...paths,
      [target]: moved
        ? {
            ...current,
            visits: current.visits + moved.visits,
            firstSeenAt: Math.min(current.firstSeenAt, moved.firstSeenAt),
            lastVisitedAt: maxOrNull(current.lastVisitedAt, moved.lastVisitedAt),
            requests: mergeRequests(current.requests, moved.requests),
          }
        : current,
    },
  };
}

/** `from` redirected to another known route `to` — tested, data stays put. */
export const withRedirect = (map: RouteMap, from: string, to: string): RouteMap => ({
  ...map,
  redirects: {
    ...map.redirects,
    [normalizeRoutePath(from)]: normalizeRoutePath(to),
  },
});
