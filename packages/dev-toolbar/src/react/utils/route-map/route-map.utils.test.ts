import { describe, expect, it } from 'vitest';

import type { RequestLogEntry } from '../request-log/request-log.constants';
import { createRouteMap, parseRouteMap, withAlias, withRedirect, withRequests, withVisit } from './route-map.utils';

const entry = (overrides: Partial<RequestLogEntry>): RequestLogEntry => ({
  id: 'b1',
  source: 'browser',
  method: 'GET',
  url: '/api/health',
  page: '/pricing',
  via: null,
  status: 200,
  startedAt: 0,
  durationMs: 10,
  sizeBytes: 100,
  ...overrides,
});

describe('route map', () => {
  it('counts visits per normalized path', () => {
    let map = createRouteMap(1);
    map = withVisit(map, '/pricing/', 2);
    map = withVisit(map, '/pricing', 3);
    expect(map.paths['/pricing']).toMatchObject({
      visits: 2,
      firstSeenAt: 2,
      lastVisitedAt: 3,
    });
  });

  it('aggregates settled requests per path, once per entry id', () => {
    const entries = [
      entry({ id: 'b1', sizeBytes: 100, durationMs: 10 }),
      entry({ id: 'b2', sizeBytes: 300, durationMs: 5 }),
      entry({ id: 's1', source: 'server', url: '/api/pages', sizeBytes: null }),
      entry({ id: 'b3', status: 'pending' }),
      entry({ id: 's2', source: 'server', page: null }),
      entry({ id: 's3', source: 'server', page: '/_next/image' }),
      entry({ id: 's4', source: 'server', page: '/api/health' }),
    ];
    const first = withRequests(createRouteMap(1), entries, new Set(), 5);
    expect(first.consumed).toEqual(['b1', 'b2', 's1']);
    expect(Object.keys(first.map.paths)).toEqual(['/pricing']);

    const requests = first.map.paths['/pricing']!.requests;
    expect(requests['browser GET /api/health']).toMatchObject({
      count: 2,
      sizeBytes: 300,
      maxDurationMs: 10,
    });
    expect(requests['server GET /api/pages']).toMatchObject({
      count: 1,
      sizeBytes: null,
    });
    // A request can arrive before the visit (prefetch): the path exists
    // with zero visits.
    expect(first.map.paths['/pricing']!.visits).toBe(0);

    const again = withRequests(first.map, entries, new Set(first.consumed), 6);
    expect(again.consumed).toEqual([]);
    expect(again.map).toBe(first.map);
  });

  it('restores a stored run and resets on garbage or another version', () => {
    const map = withVisit(createRouteMap(1), '/', 2);
    expect(parseRouteMap(JSON.stringify(map), 9)).toEqual(map);
    expect(parseRouteMap('not json', 9)).toEqual(createRouteMap(9));
    expect(parseRouteMap('{"version":0}', 9)).toEqual(createRouteMap(9));
    expect(parseRouteMap(null, 9)).toEqual(createRouteMap(9));
  });
});

describe('route map redirects', () => {
  it('aliases a translated landing URL onto its route and merges its data', () => {
    let map = createRouteMap(1);
    // Landed on the translated slug before the redirect was understood.
    map = withVisit(map, '/pl/jak-ze-mna-pracowac', 2);
    map = withRequests(map, [entry({ id: 's1', page: '/pl/jak-ze-mna-pracowac' })], new Set(), 2).map;
    map = withAlias(map, '/pl/jak-ze-mna-pracowac', '/pl/how-to-work-with-me', 3);

    expect(map.paths['/pl/jak-ze-mna-pracowac']).toBeUndefined();
    expect(map.paths['/pl/how-to-work-with-me']).toMatchObject({ visits: 1 });
    expect(Object.keys(map.paths['/pl/how-to-work-with-me']!.requests)).toHaveLength(1);

    // Later visits + requests on the landed URL land on the route.
    map = withVisit(map, '/pl/jak-ze-mna-pracowac', 4);
    map = withRequests(map, [entry({ id: 'b9', page: '/pl/jak-ze-mna-pracowac' })], new Set(), 4).map;
    expect(map.paths['/pl/how-to-work-with-me']!.visits).toBe(2);
    expect(map.paths['/pl/how-to-work-with-me']!.requests['browser GET /api/health']).toMatchObject({ count: 2 });
  });

  it('merges request counts when both paths had the same request', () => {
    let map = withRequests(
      createRouteMap(1),
      [entry({ id: 'a', page: '/landed', sizeBytes: 10 }), entry({ id: 'b', page: '/route', sizeBytes: 30 })],
      new Set(),
      1
    ).map;
    map = withAlias(map, '/landed', '/route', 2);
    expect(map.paths['/route']!.requests['browser GET /api/health']).toMatchObject({ count: 2, sizeBytes: 30 });
  });

  it('records a redirect to another known route without moving data', () => {
    const map = withRedirect(withVisit(createRouteMap(1), '/', 2), '/app/account/', '/');
    expect(map.redirects).toEqual({ '/app/account': '/' });
    expect(map.paths['/']!.visits).toBe(1);
  });

  it('fills aliases/redirects when restoring an older stored run', () => {
    const old = { version: 1, startedAt: 5, paths: {} };
    expect(parseRouteMap(JSON.stringify(old), 9)).toEqual({
      ...old,
      aliases: {},
      redirects: {},
    });
  });
});
