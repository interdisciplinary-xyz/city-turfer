import { describe, expect, it } from 'vitest';

import { buildRouteInventory } from '../route-inventory';
import type { RouteMap, RouteMapPath } from '../route-map';
import {
  buildRouteCoverage,
  buildRouteMapExport,
  filterCoverageRows,
  isLocaleCookieRedirect,
  nextUnvisitedHref,
  routeHref,
} from './route-coverage';

const ITEMS = buildRouteInventory(
  {
    sitemapPaths: ['/', '/pricing'],
    filePatterns: ['/', '/u/[slug]', '/app/account'],
  },
  ['pl']
);

const recorded = (
  path: string,
  visits: number,
  requests: Array<[string, number, number | null]> = []
): RouteMapPath => ({
  path,
  visits,
  firstSeenAt: 0,
  lastVisitedAt: visits ? 1 : null,
  requests: Object.fromEntries(
    requests.map(([url, count, sizeBytes]) => {
      const key = `server GET ${url}`;
      return [
        key,
        {
          key,
          source: 'server' as const,
          method: 'GET',
          url,
          via: null,
          count,
          lastStatus: 200,
          sizeBytes,
          maxDurationMs: 5,
        },
      ];
    })
  ),
});

const MAP: RouteMap = {
  version: 1,
  startedAt: 0,
  aliases: {},
  redirects: {},
  paths: {
    '/': recorded('/', 2, [
      ['/api/pages', 3, 1000],
      ['/api/plans', 1, null],
    ]),
    '/u/jane': recorded('/u/jane', 1, [['/api/users/by-slug/jane', 1, 500]]),
    '/pl/u/bob': recorded('/pl/u/bob', 1, [['/api/users/by-slug/bob', 1, 700]]),
    // Prefetched only — not a visit.
    '/pricing': recorded('/pricing', 0, [['/api/pages?pricing', 1, 10]]),
    '/secret-draft': recorded('/secret-draft', 1),
  },
};

describe('buildRouteCoverage', () => {
  const coverage = buildRouteCoverage(ITEMS, MAP);
  const row = (key: string) => coverage.rows.find((r) => r.key === key)!;

  it('counts visited inventory routes, ignoring prefetch-only and unlisted', () => {
    expect(coverage.total).toBe(4);
    expect(coverage.visited).toBe(2);
    expect(row('/pricing').visited).toBe(false);
    expect(row('/app/account').visited).toBe(false);
  });

  it('groups concrete paths under their pattern and totals them', () => {
    expect(row('/u/[slug]')).toMatchObject({
      visits: 2,
      uniqueRequests: 2,
      totalCalls: 2,
      totalBytes: 1200,
    });
    expect(row('/u/[slug]').paths.map((p) => p.path)).toEqual(['/pl/u/bob', '/u/jane']);
    expect(row('/')).toMatchObject({ totalCalls: 4, totalBytes: 1000 });
  });

  it('lists unknown paths as unlisted rows after the inventory', () => {
    expect(coverage.rows.at(-1)).toMatchObject({
      key: '/secret-draft',
      kind: 'unlisted',
    });
  });

  it('filters rows and exports the run', () => {
    expect(filterCoverageRows(coverage.rows, 'unvisited').map((r) => r.key)).toEqual(['/pricing', '/app/account']);
    const exported = buildRouteMapExport(MAP, coverage, 0);
    expect(exported.coverage).toEqual({ visited: 2, total: 4 });
    expect(exported.routes).toHaveLength(5);
  });
});

describe('navigation helpers', () => {
  const { rows } = buildRouteCoverage(ITEMS, MAP);
  const row = (key: string) => rows.find((r) => r.key === key)!;

  it('links pages to themselves and patterns to a recorded path', () => {
    expect(routeHref(row('/pricing'))).toBe('/pricing');
    expect(routeHref(row('/u/[slug]'))).toBe('/pl/u/bob');
    expect(routeHref(row('/app/account'))).toBeNull();
  });

  it('picks the next unvisited page after the current one, wrapping', () => {
    // Pages in order: '/', '/pricing' (unvisited: only prefetched).
    expect(nextUnvisitedHref(rows, '/')).toBe('/pricing');
    expect(nextUnvisitedHref(rows, '/pricing')).toBeNull();
    expect(nextUnvisitedHref(rows, '/u/[slug]')).toBe('/pricing');
  });
});

describe('redirects in coverage', () => {
  it('counts a redirected route as tested and shows aliases', () => {
    const coverage = buildRouteCoverage(ITEMS, {
      ...MAP,
      redirects: { '/pricing': '/' },
      aliases: { '/cennik-old': '/pricing' },
    });
    const pricing = coverage.rows.find((r) => r.key === '/pricing')!;
    expect(pricing).toMatchObject({
      visited: true,
      redirectsTo: '/',
      aliases: ['/cennik-old'],
    });
    expect(coverage.visited).toBe(3);
    expect(nextUnvisitedHref(coverage.rows, '/')).toBeNull();
  });
});

describe('isLocaleCookieRedirect', () => {
  const rowWith = (key: string, redirectsTo: string | null) =>
    ({ key, redirectsTo }) as Parameters<typeof isLocaleCookieRedirect>[0];

  it('flags an unprefixed route redirected into a locale', () => {
    expect(isLocaleCookieRedirect(rowWith('/', '/pl'), ['pl'])).toBe(true);
    expect(isLocaleCookieRedirect(rowWith('/pricing', '/pl/cennik'), ['pl'])).toBe(true);
  });

  it('ignores ordinary redirects', () => {
    expect(isLocaleCookieRedirect(rowWith('/app/account', '/'), ['pl'])).toBe(false);
    expect(isLocaleCookieRedirect(rowWith('/pl/a', '/pl/b'), ['pl'])).toBe(false);
    expect(isLocaleCookieRedirect(rowWith('/', null), ['pl'])).toBe(false);
  });
});

describe('nextUnvisitedHref exclusions', () => {
  it('skips routes autoplay already tried', () => {
    const { rows } = buildRouteCoverage(ITEMS, MAP);
    expect(nextUnvisitedHref(rows, '/')).toBe('/pricing');
    expect(nextUnvisitedHref(rows, '/', new Set(['/pricing']))).toBeNull();
  });
});
