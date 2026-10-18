import { matchRouteItem, type RouteInventoryItem } from '../route-inventory';
import type { RouteMap, RouteMapPath } from '../route-map';
import type { RouteCoverage, RouteCoverageFilter, RouteCoverageRow, RouteMapExport } from './route-coverage.constants';

const toRow = (key: string, kind: RouteCoverageRow['kind'], paths: RouteMapPath[], map: RouteMap): RouteCoverageRow => {
  const requests = paths.flatMap((p) => Object.values(p.requests));
  const visits = paths.reduce((sum, p) => sum + p.visits, 0);
  const redirectsTo = map.redirects[key] ?? null;
  return {
    key,
    kind,
    paths: [...paths].sort((a, b) => a.path.localeCompare(b.path)),
    // A route that redirected elsewhere has been tested, too.
    visited: visits > 0 || redirectsTo !== null,
    redirectsTo,
    aliases: Object.entries(map.aliases)
      .filter(([, target]) => target === key)
      .map(([landed]) => landed)
      .sort(),
    visits,
    uniqueRequests: new Set(requests.map((r) => r.key)).size,
    totalCalls: requests.reduce((sum, r) => sum + r.count, 0),
    totalBytes: requests.reduce((sum, r) => sum + (r.sizeBytes ?? 0), 0),
  };
};

/**
 * Join the inventory with the recorded run: one row per inventory route
 * (in inventory order), then any recorded path the inventory doesn't know
 * as `unlisted`. `visited` counts inventory routes with ≥1 page view — a
 * route that was only prefetched from elsewhere is not visited.
 */
export function buildRouteCoverage(items: readonly RouteInventoryItem[], map: RouteMap): RouteCoverage {
  const byItem = new Map<string, RouteMapPath[]>();
  const unlisted: RouteMapPath[] = [];

  for (const recorded of Object.values(map.paths)) {
    const item = matchRouteItem(items, recorded.path);
    if (item) {
      byItem.set(item.key, [...(byItem.get(item.key) ?? []), recorded]);
    } else {
      unlisted.push(recorded);
    }
  }

  const listedRows = items.map((item) => toRow(item.key, item.kind, byItem.get(item.key) ?? [], map));
  const unlistedRows = unlisted
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((p) => toRow(p.path, 'unlisted', [p], map));

  return {
    rows: [...listedRows, ...unlistedRows],
    total: items.length,
    visited: listedRows.filter((row) => row.visited).length,
  };
}

export const filterCoverageRows = (
  rows: readonly RouteCoverageRow[],
  filter: RouteCoverageFilter
): RouteCoverageRow[] =>
  rows.filter((row) => (filter === 'all' ? true : filter === 'visited' ? row.visited : !row.visited));

export const buildRouteMapExport = (map: RouteMap, coverage: RouteCoverage, now: number): RouteMapExport => ({
  startedAt: new Date(map.startedAt).toISOString(),
  exportedAt: new Date(now).toISOString(),
  coverage: { visited: coverage.visited, total: coverage.total },
  routes: coverage.rows.map((row) => ({
    route: row.key,
    kind: row.kind,
    visited: row.visited,
    redirectsTo: row.redirectsTo,
    aliases: row.aliases,
    visits: row.visits,
    uniqueRequests: row.uniqueRequests,
    totalCalls: row.totalCalls,
    totalBytes: row.totalBytes,
    paths: row.paths.map((p) => ({
      path: p.path,
      visits: p.visits,
      requests: Object.values(p.requests).sort((a, b) => a.key.localeCompare(b.key)),
    })),
  })),
});

/** Trigger a browser download of `data` as pretty-printed JSON. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Where a row's link goes: the page itself, or — for a pattern like
 * `/u/[slug]`, which has no URL of its own — the first real path recorded
 * under it. `null` = nothing navigable yet.
 */
export const routeHref = (row: RouteCoverageRow): string | null =>
  row.kind === 'pattern' ? (row.paths[0]?.path ?? null) : row.key;

/**
 * The next route to test: the first unvisited sitemap page after the
 * current one in list order, wrapping around. Patterns are skipped (they
 * need a real id to open). `exclude` drops routes already tried — autoplay
 * passes the ones it opened that still didn't count as visited (a 404, an
 * error page), so it can't open them forever.
 */
export function nextUnvisitedHref(
  rows: readonly RouteCoverageRow[],
  currentKey: string,
  exclude: ReadonlySet<string> = new Set()
): string | null {
  const candidates = rows.filter((row) => row.kind === 'page');
  const start = candidates.findIndex((row) => row.key === currentKey);
  for (let i = 1; i <= candidates.length; i += 1) {
    const row = candidates[(start + i) % candidates.length];
    if (row && !row.visited && row.key !== currentKey && !exclude.has(row.key)) {
      return row.key;
    }
  }
  return null;
}

/**
 * Whether a recorded redirect only added a locale prefix — the app's
 * `NEXT_LOCALE` cookie sending an unprefixed (default-locale) URL to the
 * remembered locale, e.g. `/` → `/pl`. Worth flagging: while that cookie is
 * set, default-locale pages can't be visited at all.
 */
export function isLocaleCookieRedirect(row: RouteCoverageRow, localePrefixes: readonly string[]): boolean {
  if (!row.redirectsTo) {
    return false;
  }
  const prefixOf = (path: string) =>
    localePrefixes.find((locale) => path === `/${locale}` || path.startsWith(`/${locale}/`)) ?? null;
  return prefixOf(row.key) === null && prefixOf(row.redirectsTo) !== null;
}
