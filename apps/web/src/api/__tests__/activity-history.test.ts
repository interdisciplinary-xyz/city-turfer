// The activity history's pure parts: the list query, month grouping and times in the activity's
// own zone (H5), the route → SVG projection (H1) and the numbers from core's formatters (H4).
// Positions are made up around Gdańsk's Long Market (a public square), never a real trace.
import { formatDistance, formatDuration, formatPaceOrSpeed } from '@cityturfer/core/shared-kernel';
import { describe, expect, it } from 'vitest';

import {
  healthLeftOut,
  historyEmpty,
} from '../../app/[locale]/account/_portal/activities-empty/activities-empty.constants';
import { activityNumbers, splitPace } from '../../app/[locale]/account/_portal/activity-numbers';
import { activityView } from '../../app/[locale]/account/_portal/activity-page/activity-page.constants';
import {
  detailWhen,
  displayZone,
  groupByMonth,
  monthKey,
  monthLabel,
  rowWhen,
} from '../../app/[locale]/account/_portal/activity-time';
import { totalsTiles } from '../../app/[locale]/account/_portal/activity-totals/activity-totals.constants';
import { portalLocation } from '../../app/[locale]/account/_portal/portal-nav/portal-nav.constants';
import {
  previewLines,
  routeShape,
  simplifyLines,
  type TrackColumns,
  trackLines,
} from '../../app/[locale]/account/_portal/route-shape';
import { isActivityId } from '../activity-id';
import { PortalError } from '../errors';
import { activityListQuery } from '../portal-api';

const at = (startedAt: string, timeZone: string | null = 'Europe/Warsaw', id = startedAt) => ({
  id,
  startedAt,
  timeZone,
});

describe('activityListQuery', () => {
  it('sends the page size, and the cursor and type only when set', () => {
    expect(activityListQuery({ limit: 50, cursor: null, type: null })).toEqual({ limit: 50 });
    expect(activityListQuery({ limit: 50, cursor: 'abc', type: 'cycle' })).toEqual({
      limit: 50,
      cursor: 'abc',
      type: 'cycle',
    });
  });
});

describe('isActivityId', () => {
  it('takes the phone ids and nothing else', () => {
    expect(isActivityId('3f9c2a64-5d1e-4b8e-9a51-0c7d2e6f1b20')).toBe(true);
    expect(isActivityId('hk-ABC_123')).toBe(true);
    for (const bad of [null, undefined, '', '54.35,18.65', '../me', 'a b', 'x'.repeat(101)]) {
      expect(isActivityId(bad)).toBe(false);
    }
  });
});

describe('times in the activity zone (H5)', () => {
  it('groups by the local month, not the UTC one', () => {
    // 23:30 UTC on 31 October is already 1 November in Warsaw (UTC+1 in winter).
    const late = at('2026-10-31T23:30:00Z');
    expect(monthKey(late)).toBe('2026-11');
    expect(monthKey(at('2026-10-31T23:30:00Z', 'America/New_York'))).toBe('2026-10');
  });

  it('falls back to the given (browser) zone when the zone is null or unknown', () => {
    expect(monthKey(at('2026-10-31T23:30:00Z', null), 'UTC')).toBe('2026-10');
    expect(monthKey(at('2026-10-31T23:30:00Z', 'Mars/Olympus'), 'Europe/Warsaw')).toBe('2026-11');
    expect(displayZone('Mars/Olympus', 'UTC')).toBe('UTC');
    expect(displayZone('Europe/Warsaw', 'UTC')).toBe('Europe/Warsaw');
    expect(displayZone(null)).toBeUndefined();
  });

  it('keeps newest month first and the API order inside a month', () => {
    const items = [
      at('2026-11-02T08:00:00Z', 'Europe/Warsaw', 'c'),
      at('2026-10-31T23:30:00Z', 'Europe/Warsaw', 'b'), // November in Warsaw
      at('2026-10-20T08:00:00Z', 'Europe/Warsaw', 'a'),
      at('2026-09-01T08:00:00Z', 'Europe/Warsaw', 'z'),
    ];
    const groups = groupByMonth(items);
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['2026-11', ['c', 'b']],
      ['2026-10', ['a']],
      ['2026-09', ['z']],
    ]);
    expect(groupByMonth([])).toEqual([]);
  });

  it('names months in the page language', () => {
    expect(monthLabel('en-GB', '2026-10')).toBe('October 2026');
    expect(monthLabel('pl', '2026-10')).toBe('październik 2026');
  });

  it('shows day and time as the phone recorded them', () => {
    const run = at('2026-10-22T05:12:00Z', 'Europe/Warsaw');
    expect(rowWhen('en-GB', run)).toBe('Thu 22 Oct, 07:12');
    expect(rowWhen('pl', run)).toBe('czw., 22 paź, 07:12');
    // The zone's name only when it isn't the browser's.
    expect(detailWhen('en-GB', run, 'Europe/Warsaw')).toBe('Thursday, 22 October 2026 at 07:12');
    expect(detailWhen('en-GB', run, 'Europe/London')).toMatch(/^Thursday, 22 October 2026 at 07:12 (CEST|GMT\+2)$/);
    // The browser's zone unknown: name the activity's; no zone at all: nothing to name.
    expect(detailWhen('en-GB', run, undefined)).toMatch(/07:12 (CEST|GMT\+2)$/);
    expect(detailWhen('en-GB', at('2026-10-22T05:12:00Z', null), undefined)).not.toMatch(/GMT|CEST|UTC/);
  });
});

const P = (dLon: number, dLat: number, segment = 0, t = 0): TrackColumns => [
  18.6535 + dLon,
  54.3485 + dLat,
  1_760_000_000_000 + t,
  segment,
  null,
];

describe('trackLines', () => {
  it('splits by segment and connects each gap, along the estimate when there is one', () => {
    const points = [P(0, 0, 0), P(0.001, 0, 0), P(0.002, 0, 1), P(0.003, 0, 1), P(0.004, 0, 2), P(0.005, 0, 2)];
    const lines = trackLines(points, [{ afterSegment: 1, coords: [[18.6566, 54.349]] }]);
    expect(lines.segments).toHaveLength(3);
    const xy = (p: TrackColumns) => [p[0], p[1]];
    expect(lines.gaps).toEqual([
      [xy(points[1]), xy(points[2])],
      [xy(points[3]), [18.6566, 54.349], xy(points[4])],
    ]);
  });

  it('finds a gap route by segment index, not segment number (segments 0, 2, 3)', () => {
    const points = [P(0, 0, 0), P(0.001, 0, 0), P(0.002, 0, 2), P(0.003, 0, 2), P(0.004, 0, 3), P(0.005, 0, 3)];
    const lines = trackLines(points, [{ afterSegment: 1, coords: [[18.6566, 54.349]] }]);
    const xy = (p: TrackColumns) => [p[0], p[1]];
    expect(lines.gaps).toEqual([
      [xy(points[1]), xy(points[2])],
      [xy(points[3]), [18.6566, 54.349], xy(points[4])],
    ]);
  });

  it('has no gaps for one segment', () => {
    expect(trackLines([P(0, 0), P(0.001, 0.001)]).gaps).toEqual([]);
  });
});

describe('routeShape', () => {
  const box = { width: 100, height: 100, padding: 10 };

  it('fits the route into the box, aspect kept, centred, north up', () => {
    // 0.002° of longitude at 54.35° is about as long as 0.001166° of latitude: cos(54.35°) ≈ 0.583.
    const shape = routeShape(
      {
        segments: [
          [
            [18.6535, 54.3485],
            [18.6555, 54.3485],
          ],
        ],
        gaps: [],
      },
      box
    )!;
    expect(shape.track).toBe('M10 50L90 50');
    expect(shape.gaps).toBe('');
    expect(shape.start).toEqual({ x: 10, y: 50 });
    expect(shape.end).toEqual({ x: 90, y: 50 });

    const square = routeShape(
      {
        segments: [
          [
            [18.6535, 54.3485],
            [18.6555, 54.3485],
            [18.6555, 54.34966],
          ],
        ],
        gaps: [],
      },
      box
    )!;
    // East is right, north is up (smaller y); the box is about square in metres, so it fills both ways.
    const [, x1, y1, x2, y2, x3, y3] = square.track.match(/^M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)$/)!;
    expect(Number(x2)).toBeGreaterThan(Number(x1));
    expect(Number(y2)).toBe(Number(y1));
    expect(Number(x3)).toBe(Number(x2));
    expect(Number(y3)).toBeLessThan(Number(y2));
    expect(Math.abs(Number(x2) - Number(x1) - (Number(y2) - Number(y3)))).toBeLessThan(1.5);
  });

  it('draws gaps as their own path', () => {
    const lines = trackLines([P(0, 0, 0), P(0.001, 0, 0), P(0.002, 0, 1), P(0.003, 0, 1)]);
    const shape = routeShape(lines, box)!;
    expect(shape.track.match(/M/g)).toHaveLength(2);
    expect(shape.gaps.match(/M/g)).toHaveLength(1);
  });

  it('copes with a single spot and with nothing', () => {
    expect(routeShape(previewLines([]), box)).toBeNull();
    const spot = routeShape(previewLines([[18.6535, 54.3485]]), box)!;
    expect(spot.track).toBe('');
    expect(spot.start).toEqual({ x: 50, y: 50 });
  });
});

describe('simplifyLines', () => {
  it('drops points that a pixel would not show, keeps the ends', () => {
    const wiggle = Array.from({ length: 2001 }, (_, i) => P(i * 0.00001, (i % 2) * 0.0000001));
    const lines = simplifyLines(trackLines(wiggle));
    expect(lines.segments[0].length).toBeLessThan(10);
    expect(lines.segments[0][0]).toEqual([wiggle[0][0], wiggle[0][1]]);
    expect(lines.segments[0].at(-1)).toEqual([wiggle[2000][0], wiggle[2000][1]]);
  });
});

describe('numbers as the app shows them (H4)', () => {
  const run = {
    type: 'run' as const,
    distanceM: 5020,
    estimatedDistanceM: 240,
    movingS: 1694,
    elapsedS: 1760,
    elevationGainM: 24,
  };

  it('uses core formatters with the page language', () => {
    const en = activityNumbers(run, 'en');
    expect(en.distance).toEqual(formatDistance(5020, 'en'));
    expect(en.distance).toEqual({ value: '5.02', unit: 'km' });
    expect(en.moving).toBe(formatDuration(1694));
    expect(en.pace).toEqual(formatPaceOrSpeed('run', 5020, 1694, 'en'));
    expect(en.pace).toEqual({ value: '5:37', unit: '/km' });
    expect(en.estimated).toBe(true);
    expect(en.estimatedText).toBe('240 m');
    expect(en.elevation).toBe('+24');

    const pl = activityNumbers({ ...run, type: 'cycle', elevationGainM: null, estimatedDistanceM: 0 }, 'pl');
    expect(pl.distance).toEqual({ value: '5,02', unit: 'km' });
    expect(pl.pace).toEqual({ value: '10,7', unit: 'km/h' });
    expect(pl.estimated).toBe(false);
    expect(pl.elevation).toBeNull();
  });

  it('shows splits as pace, or speed for rides', () => {
    expect(splitPace('walk', 600, 'en')).toEqual({ value: '10:00', unit: '/km' });
    expect(splitPace('cycle', 180, 'pl')).toEqual({ value: '20,0', unit: 'km/h' });
  });
});

describe('portalLocation (header links, language links)', () => {
  const q = (s: string) => new URLSearchParams(s);
  it('marks the section of each signed-in page', () => {
    expect(portalLocation('/en/account', 'en', null)).toEqual({ path: '/account', section: 'privacy', exact: true });
    expect(portalLocation('/pl/account/activities/', 'pl', null)).toEqual({
      path: '/account/activities',
      section: 'activities',
      exact: true,
    });
    expect(portalLocation('/en/account/activity', 'en', q('id=abc-1'))).toEqual({
      path: '/account/activity?id=abc-1',
      section: 'activities',
      exact: false,
    });
  });

  it('carries only a valid id over to the other language, nothing else from the query', () => {
    expect(portalLocation('/en/account/activity', 'en', q('id=54.35,18.65&x=1')).path).toBe('/account/activity');
    expect(portalLocation('/en/account/activity', 'en', null).path).toBe('/account/activity');
    expect(portalLocation('/en/account/other', 'en', q('id=a')).section).toBeNull();
  });
});

describe('historyEmpty', () => {
  const on = { kind: 'on', since: 'x', policyVersion: '2026-10', health: { included: false } } as const;
  const ok = (backup: Parameters<typeof healthLeftOut>[0] & object) => ({ status: 'success' as const, backup });
  it('picks the empty state from the backup, then the filter', () => {
    expect(historyEmpty({ consents: ok({ kind: 'never' }), type: null, listed: 0 })).toBe('never');
    expect(historyEmpty({ consents: ok({ kind: 'withdrawn', at: 'x' }), type: 'run', listed: 0 })).toBe('withdrawn');
    expect(historyEmpty({ consents: ok(on), type: null, listed: 0 })).toBe('nothing-yet');
    expect(historyEmpty({ consents: ok(on), type: 'cycle', listed: 0 })).toBe('filter');
    expect(historyEmpty({ consents: ok({ kind: 'never' }), type: null, listed: 3 })).toBeNull();
  });

  it('waits for the consents, and says nothing about the backup when they failed', () => {
    expect(historyEmpty({ consents: { status: 'pending' }, type: null, listed: 0 })).toBe('waiting');
    expect(historyEmpty({ consents: { status: 'pending' }, type: 'walk', listed: 0 })).toBe('waiting');
    expect(historyEmpty({ consents: { status: 'error' }, type: null, listed: 0 })).toBe('unknown');
    expect(historyEmpty({ consents: { status: 'error' }, type: 'walk', listed: 0 })).toBe('filter');
    expect(historyEmpty({ consents: { status: 'pending' }, type: null, listed: 2 })).toBeNull();
  });

  it('says Apple Health workouts stay on the phone only when backup is on without them', () => {
    expect(healthLeftOut(on)).toBe(true);
    expect(healthLeftOut({ ...on, health: { included: true, since: 'x' } })).toBe(false);
    expect(healthLeftOut({ kind: 'never' })).toBe(false);
    expect(healthLeftOut(null)).toBe(false);
  });
});

describe('activityView', () => {
  const base = { rawId: 'abc', validId: true, hasData: false, error: null };
  it('no id → the list; a bad id or a 404 → not found; a 410 → deleted', () => {
    expect(activityView({ ...base, rawId: null, validId: false })).toEqual({ kind: 'to-list' });
    expect(activityView({ ...base, rawId: '', validId: false })).toEqual({ kind: 'to-list' });
    expect(activityView({ ...base, rawId: '../x', validId: false })).toEqual({ kind: 'not-found' });
    expect(activityView({ ...base, error: new PortalError('not-found', { status: 404 }) })).toEqual({
      kind: 'not-found',
    });
    expect(activityView({ ...base, error: new PortalError('activity.deleted', { status: 410 }) })).toEqual({
      kind: 'deleted',
    });
  });

  it('loading, the activity, outages and a lost session', () => {
    expect(activityView(base)).toEqual({ kind: 'loading' });
    expect(activityView({ ...base, hasData: true })).toEqual({ kind: 'activity' });
    expect(activityView({ ...base, error: new PortalError('unreachable') }).kind).toBe('unreachable');
    expect(activityView({ ...base, error: new PortalError('generic', { status: 500 }) }).kind).toBe('error');
    expect(activityView({ ...base, hasData: true, error: new PortalError('signed-out', { status: 401 }) })).toEqual({
      kind: 'leaving',
    });
  });
});

describe('totalsTiles', () => {
  const zero = { count: 0, distanceM: 0, movingS: 0 };
  it('always has All, and only the types with something backed up', () => {
    const tiles = totalsTiles({
      allTime: { count: 2, distanceM: 9000, movingS: 3000 },
      byType: { walk: zero, run: { count: 2, distanceM: 9000, movingS: 3000 }, cycle: zero },
    });
    expect(tiles.map((tile) => tile.key)).toEqual(['all', 'run']);
  });
});
