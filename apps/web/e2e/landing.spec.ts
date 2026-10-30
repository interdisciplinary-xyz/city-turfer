// The public pages keep their promise for a signed-out visitor (web-motion Site ground rules):
// no cookie, no API call, nothing from another origin. The allow-list itself is checked by the
// `network` fixture after each test.
import { expect, test } from './support/fixtures';

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
