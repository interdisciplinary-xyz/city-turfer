// The portal's activity history (docs/plans/web-portal-history-2026-10-23.md) against the API on
// PGlite: activities seeded through the API's own backup routes, as a phone would, then read in the
// browser. Every test uses its own @e2e.cityturfer.test address; the fixture fails any test on a
// request outside the site, an e-mail or a coordinate in a URL, or a CSP violation.
import { formatDistance, formatDuration, formatPaceOrSpeed } from '@cityturfer/core/shared-kernel';
import type { Page } from '@playwright/test';

import type { ActivitySummary, ActivityType } from '../src/api/schema';
import { activityId, seedApi, upload } from './support/activities';
import { expect, expectNoHorizontalScroll, expectNoSeriousAxe, signIn, test, testEmail } from './support/fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;
/** 22 October 2026, 07:12 in Warsaw: the newest seeded activity; older ones a day apart. */
const NEWEST_MS = Date.UTC(2026, 9, 22, 5, 12);
const TYPES: readonly ActivityType[] = ['run', 'walk', 'cycle'];
const RIDE = { walk: 'Walk', run: 'Run', cycle: 'Ride' } as const;

const rows = (page: Page) => page.locator('.portal-activities > li');
const isActivityList = (url: URL) => url.pathname === '/api/v1/activities';

// H5: times read as the phone recorded them (Europe/Warsaw), while this browser is in New York:
// every expectation below is Warsaw time, and the detail names the zone.
test.use({ timezoneId: 'America/New_York' });
const shown = (q: { value: string; unit: string }) => `${q.value} ${q.unit}`;

async function expectNoStorage(page: Page) {
  const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
  expect(storage).toEqual({ local: 0, session: 0 });
}

test('history: totals, list by month, show more, filter, detail with splits and gaps; axe; 320 px', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await signIn(page, testEmail('history'));
  const api = seedApi(context.request, baseURL ?? '');
  await api.grant('cloud-sync');
  await api.grant('apple-health-in-cloud-sync');

  // 53 activities, one a day: more than one page of 50, across three months.
  const seeded: ActivitySummary[] = [];
  for (let i = 0; i < 53; i++) {
    const type = TYPES[i % 3];
    const health = i === 4;
    const id = health ? activityId('hk') : activityId();
    seeded.push(
      await api.upload(
        id,
        upload({
          type,
          name: `${RIDE[type]} ${i + 1}`,
          startMs: NEWEST_MS - i * DAY_MS,
          source: health ? 'apple-health' : 'recording',
          offsetM: [(i % 7) * 40, (i % 5) * 30],
        })
      )
    );
  }
  // The newest has a GPS gap the phone estimated along streets (dashed, counted in distance).
  const gappedId = activityId();
  const twoParts = upload({
    type: 'run',
    name: 'Run with a gap',
    startMs: NEWEST_MS + 2 * 60 * 60 * 1000,
    segments: [
      [{ metres: 900, bearing: 90 }],
      [
        { metres: 700, bearing: 0 },
        { metres: 300, bearing: 270 },
      ],
    ],
  });
  await api.upload(gappedId, twoParts);
  const end0 = twoParts.track.points.filter((p) => p[3] === 0).at(-1)!;
  const start1 = twoParts.track.points.find((p) => p[3] === 1)!;
  const withGap = await api.gapRoutes(gappedId, [
    {
      afterSegment: 0,
      distanceM: 180,
      movingS: 60,
      coords: [
        [end0[0], end0[1]],
        [Number(((end0[0] + start1[0]) / 2).toFixed(6)), Number((end0[1] + 0.0004).toFixed(6))],
        [start1[0], start1[1]],
      ],
    },
  ]);
  seeded.unshift(withGap);

  // From Privacy & data through the header link.
  await page.locator('.portal-nav').getByRole('link', { name: 'Activities' }).click();
  await expect(page).toHaveURL(/\/en\/account\/activities$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Activities' })).toBeVisible();
  await expect(page.locator('.portal-nav').getByRole('link', { name: 'Activities' })).toHaveAttribute(
    'aria-current',
    'page'
  );

  // All-time totals: the count and the core-formatted sums of what the API stored.
  const sum = (items: ActivitySummary[], key: 'distanceM' | 'movingS') => items.reduce((s, a) => s + a[key], 0);
  const allTile = page.locator('.portal-total').first();
  await expect(allTile).toContainText('All');
  await expect(allTile).toContainText(formatDistance(sum(seeded, 'distanceM'), 'en').value);
  await expect(allTile).toContainText(`54 activities · ${formatDuration(sum(seeded, 'movingS'))} moving`);
  const rides = seeded.filter((a) => a.type === 'cycle');
  const rideTile = page.locator('.portal-total').filter({ hasText: 'Ride' });
  await expect(rideTile).toContainText(formatDistance(sum(rides, 'distanceM'), 'en').value);
  await expect(rideTile).toContainText(`${rides.length} activities`);

  // The first page, newest first, grouped by month; numbers as the app shows them.
  await expect(rows(page)).toHaveCount(50);
  await expect(page.getByRole('heading', { level: 2, name: 'October 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'September 2026' })).toBeVisible();
  const first = rows(page).first();
  await expect(first).toContainText('Run with a gap');
  await expect(first).toContainText('Thu 22 Oct, 09:12');
  await expect(first).toContainText('≈');
  await expect(first).toContainText(shown(formatDistance(withGap.distanceM, 'en')));
  await expect(first).toContainText(formatDuration(withGap.movingS));
  await expect(first).toContainText(shown(formatPaceOrSpeed('run', withGap.distanceM, withGap.movingS, 'en')));
  await expect(rows(page).filter({ hasText: 'From Apple Health' })).toHaveCount(1);
  await expect(rows(page).first().locator('svg')).toHaveAttribute('aria-hidden', 'true');

  await expectNoSeriousAxe(page);
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(rows(page)).toHaveCount(54);
  await expect(page.getByRole('status').filter({ hasText: 'Showing 54 activities' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'August 2026' })).toBeVisible();

  // Filter: rides only (page state, the URL stays the same).
  await page.getByRole('radio', { name: 'Rides' }).check();
  await expect(rows(page)).toHaveCount(rides.length);
  for (const label of await rows(page).locator('.portal-type-label').allTextContents()) {
    expect(label).toBe('Ride');
  }
  const ride = rides[0];
  await expect(rows(page).first()).toContainText(shown(formatPaceOrSpeed('cycle', ride.distanceM, ride.movingS, 'en')));
  await expect(page).toHaveURL(/\/en\/account\/activities$/);
  // Back to all: both pages loaded before are still in memory.
  await page.getByRole('radio', { name: 'All' }).check();
  await expect(rows(page)).toHaveCount(54);

  await page.setViewportSize({ width: 320, height: 800 });
  await expectNoHorizontalScroll(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  // One activity: stats, the estimate note, the route (gaps dashed) and the splits.
  await rows(page).first().getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/en/account/activity\\?id=${gappedId}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Run with a gap' })).toBeVisible();
  await expect(page.locator('.portal-detail-meta time')).toHaveText(
    /^Thursday, 22 October 2026 at 09:12 (GMT\+2|CEST)$/
  );
  const stats = page.locator('.portal-stats');
  await expect(stats).toContainText(`Distance≈ about ${shown(formatDistance(withGap.distanceM, 'en'))}`);
  await expect(stats).toContainText(`Moving time${formatDuration(withGap.movingS)}`);
  await expect(stats).toContainText(`Elapsed time${formatDuration(withGap.elapsedS)}`);
  await expect(page.getByText('Includes 180 m estimated along streets where GPS was lost')).toBeVisible();
  const route = page.getByRole('img', { name: /Dashed lines join the recorded parts/ });
  await expect(route).toBeVisible();
  await expect(route.locator('path.portal-route-track')).toHaveCount(1);
  await expect(route.locator('path.portal-route-gap')).toHaveCount(1);
  expect((await route.locator('path.portal-route-track').getAttribute('d'))?.match(/M/g)).toHaveLength(2);
  const splits = page.getByRole('table');
  await expect(splits.getByRole('columnheader', { name: 'Pace' })).toBeVisible();
  // A header row and one row per whole recorded kilometre (the street estimate has no splits).
  await expect(splits.getByRole('row')).toHaveCount(
    1 + Math.floor((withGap.distanceM - withGap.estimatedDistanceM) / 1000)
  );
  await expect(splits.getByRole('rowheader', { name: 'km 1' })).toBeVisible();
  await expect(page.locator('.portal-nav').getByRole('link', { name: 'Activities' })).toHaveAttribute(
    'aria-current',
    'true'
  );
  await expectNoSeriousAxe(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await expectNoHorizontalScroll(page);

  // The language link keeps the activity.
  await page.getByRole('link', { name: 'PL, Polski' }).click();
  await expect(page).toHaveURL(new RegExp(`/pl/account/activity\\?id=${gappedId}$`));
  await expect(page.getByRole('heading', { level: 2, name: 'Międzyczasy' })).toBeVisible();
  await expect(page.locator('.portal-stats')).toContainText(shown(formatDistance(withGap.distanceM, 'pl')));
  await expectNoHorizontalScroll(page);

  await page.getByRole('link', { name: 'Wszystkie aktywności' }).click();
  await expect(page).toHaveURL(/\/pl\/account\/activities$/);
  await expect(page.getByRole('heading', { level: 2, name: 'październik 2026' })).toBeVisible();
  await expectNoStorage(page);
});

test('backup on, nothing yet: the empty state and the Apple Health line; a filter with no match; not found', async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(page, testEmail('history-empty'));
  const api = seedApi(context.request, baseURL ?? '');
  await api.grant('cloud-sync');

  await page.goto('/en/account/activities');
  await expect(page.getByText('Backup is on, but nothing has arrived yet.', { exact: false })).toBeVisible();
  await expect(page.getByText("Apple Health workouts stay on your phone, so they aren't listed here.")).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expectNoSeriousAxe(page);

  await api.upload(activityId(), upload({ type: 'run', name: 'Only run', startMs: NEWEST_MS }));
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('radio', { name: 'Rides' }).check();
  await expect(page.getByText('No rides in your backup yet.')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);

  // An id that isn't there (deleted on the phone, or another user's: both 404).
  await page.goto(`/en/account/activity?id=${activityId()}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Activity not found' })).toBeVisible();
  await expect(page.getByText("It isn't in your backup.", { exact: false })).toBeVisible();
  await expectNoSeriousAxe(page);
  // An id the contract can't hold is "not found" without asking the API.
  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));
  await page.goto('/en/account/activity?id=..%2Fme');
  await expect(page.getByRole('heading', { level: 1, name: 'Activity not found' })).toBeVisible();
  expect(asked.filter((url) => url.includes('/api/v1/activities/'))).toEqual([]);

  // Deleted on the phone after it was backed up: the backup keeps a tombstone (410).
  const gone = activityId();
  await api.upload(gone, upload({ type: 'walk', name: 'Deleted walk', startMs: NEWEST_MS - DAY_MS }));
  await api.remove(gone);
  await page.goto(`/en/account/activity?id=${gone}`);
  await expect(page.getByText('This activity was deleted on your phone.')).toBeVisible();
  await expect(page.getByText('Deleted walk')).toHaveCount(0);

  // No id: back to the list.
  await page.goto('/en/account/activity');
  await expect(page).toHaveURL(/\/en\/account\/activities$/);
  await expectNoStorage(page);
});

test('backup never turned on: the empty state, no totals or filter; axe; 320 px', async ({ page }) => {
  await signIn(page, testEmail('history-never'));
  await page.goto('/en/account/activities');
  await expect(page.getByText('Nothing is backed up yet, so there', { exact: false })).toBeVisible();
  await expect(page.getByText('To turn on backup, open the app: Info › Cloud backup.')).toBeVisible();
  await expect(page.locator('.portal-total')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await expectNoHorizontalScroll(page);
});

test('backup withdrawn: the copy here is erased, everything is still on the phone', async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(page, testEmail('history-withdrawn'));
  const api = seedApi(context.request, baseURL ?? '');
  await api.grant('cloud-sync');
  await api.upload(activityId(), upload({ type: 'walk', name: 'Erased walk', startMs: NEWEST_MS }));
  await api.grant('cloud-sync', false);

  await page.goto('/en/account/activities');
  await expect(page.getByText('You turned backup off, so we erased the copy here.', { exact: false })).toBeVisible();
  await expect(page.getByText('Erased walk')).toHaveCount(0);
});

test('API unreachable: the Unreachable block, and retry brings the list', async ({ page, context, baseURL }) => {
  await signIn(page, testEmail('history-down'));
  const api = seedApi(context.request, baseURL ?? '');
  await api.grant('cloud-sync');
  await api.upload(activityId(), upload({ type: 'cycle', name: 'Ride back', startMs: NEWEST_MS }));

  await page.route(isActivityList, (route) => route.abort('connectionrefused'));
  await page.goto('/en/account/activities');
  await expect(page.getByText("Can't reach your backup right now")).toBeVisible({ timeout: 15_000 });
  await page.unroute(isActivityList);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Ride back');
});

test('H5: months and times follow the activity zone, not the browser zone', async ({ page, context, baseURL }) => {
  await signIn(page, testEmail('history-zone'));
  const api = seedApi(context.request, baseURL ?? '');
  await api.grant('cloud-sync');
  // 23:30 UTC on 31 October: 1 November, 00:30 in Warsaw, still 31 October, 19:30 in New York.
  const id = activityId();
  await api.upload(id, upload({ type: 'walk', name: 'Midnight walk', startMs: Date.UTC(2026, 9, 31, 23, 30) }));

  await page.goto('/en/account/activities');
  await expect(page.getByRole('heading', { level: 2, name: 'November 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'October 2026' })).toHaveCount(0);
  await expect(rows(page).first()).toContainText('Sun 1 Nov, 00:30');

  await rows(page).first().getByRole('link').click();
  await expect(page.locator('.portal-detail-meta time')).toHaveText(/^Sunday, 1 November 2026 at 00:30 (GMT\+1|CET)$/);
});
