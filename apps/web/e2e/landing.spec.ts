// The public pages keep their promise for a signed-out visitor (web-motion Site ground rules):
// no cookie, no API call, nothing from another origin. The allow-list itself is checked by the
// `network` fixture after each test. The homepage sections follow
// docs/plans/homepage-sections-2026-10-28.md.
import AxeBuilder from '@axe-core/playwright';

import { expect, expectNoHorizontalScroll, test } from './support/fixtures';

/** Section headings by id, in page order (the closing call to action needs the waitlist env). */
const SECTIONS = [
  'demo-title',
  'how-title',
  'audience-title',
  'highlights-title',
  'week-title',
  'differs-title',
  'local-title',
  'status-title',
  'faq-title',
];

for (const path of ['/en', '/pl']) {
  test(`landing ${path}: no cookie, no /api request, self only`, async ({ page, context, network }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible();
    expect(network.urls.filter((url) => new URL(url).pathname.startsWith('/api'))).toEqual([]);
    expect(network.setCookies).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe('');
  });

  test(`landing ${path}: every section, the prototype badge and a footer`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('.hero-badge')).toBeVisible();
    for (const id of SECTIONS) {
      await expect(page.locator(`h2#${id}`)).toHaveCount(1);
    }
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toBeVisible();
  });

  test(`landing ${path}: accessible and no sideways scroll on a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalScroll(page);
    // Scan after the hero entrance: mid-fade text reads as low contrast.
    await expect(page.locator('[data-anim="line"]').last()).toHaveCSS('opacity', '1');
    // The hero's phone mock-ups (.screens) are left out: their tab bar and "See all" link fail
    // colour contrast already on main; tracked separately from the homepage sections.
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.screens')
      .analyze();
    const serious = results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
  });
}

// The hero's street map (docs/plans/hero-city-map-2026-10-28.md): the city follows the time zone,
// only that city's maps load, and "Near me" uses the location only after a click.
const mapRequests = (urls: string[]) =>
  urls.filter((url) => new URL(url).pathname.startsWith('/city-maps/')).map((url) => new URL(url).pathname);

for (const [timezoneId, city] of [
  ['Europe/Warsaw', 'pl-gdansk'],
  ['Europe/London', 'gb-london'],
  ['America/New_York', 'pl-gdansk'],
] as const) {
  test.describe(`hero map in ${timezoneId}`, () => {
    test.use({ timezoneId });
    test(`shows ${city} and loads only its maps`, async ({ page, network }) => {
      await page.goto('/en');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.hero-city')).toHaveAttribute('data-city', city);
      await expect(page.getByLabel('City on the map')).toHaveValue(city);
      expect(mapRequests(network.urls).sort()).toEqual([
        `/city-maps/${city}-streets.svg`,
        `/city-maps/${city}-water.svg`,
      ]);
    });
  });
}

test('hero map: picking a city swaps the map', async ({ page }) => {
  await page.goto('/pl');
  await page.getByLabel('Miasto na mapie').selectOption('pl-krakow');
  await expect(page.locator('.hero-city')).toHaveAttribute('data-city', 'pl-krakow');
});

test.describe('hero map: Near me', () => {
  test.use({ timezoneId: 'Europe/Warsaw', permissions: ['geolocation'] });

  test('switches to the nearest city', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 52.25, longitude: 21.05 });
    await page.goto('/en');
    await page.getByRole('button', { name: 'Near me' }).click();
    await expect(page.locator('.hero-city')).toHaveAttribute('data-city', 'pl-warsaw');
  });

  test('keeps the guess when no city is close', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 53.43, longitude: 14.55 });
    await page.goto('/en');
    await page.getByRole('button', { name: 'Near me' }).click();
    await expect(page.getByRole('status')).toContainText('No map near you yet');
    await expect(page.locator('.hero-city')).toHaveAttribute('data-city', 'pl-gdansk');
  });
});

test('street demo: the step buttons pick a tier, Four months shows the city', async ({ page }) => {
  await page.goto('/en');
  const player = page.locator('.turf-demo-player');
  const steps = page.getByRole('group', { name: 'Show a step' }).getByRole('button');
  await steps.first().scrollIntoViewIfNeeded();
  // The buttons are server-rendered: click only once hydration has started autoplay (or retry).
  await expect(async () => {
    await steps.nth(2).click();
    await expect(player).toHaveAttribute('data-step', '2', { timeout: 1000 });
  }).toPass();
  await expect(steps.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(steps.nth(2)).toHaveText('4 visits · Strong');
  await steps.nth(4).click();
  await expect(player).toHaveAttribute('data-step', '4');
});

test('street demo: with reduced motion it stays on the final frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en');
  const player = page.locator('.turf-demo-player');
  await player.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(player).toHaveAttribute('data-step', '4');
});

test('FAQ: the structured data asks exactly the questions the page shows', async ({ page }) => {
  await page.goto('/pl');
  const shown = await page.locator('.home-faq-item summary').allTextContents();
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(ld['@type']).toBe('FAQPage');
  expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(shown);
});
