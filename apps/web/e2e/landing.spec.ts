// The public pages keep their promise for a signed-out visitor (web-motion Site ground rules):
// no cookie, no API call, nothing from another origin. The allow-list itself is checked by the
// `network` fixture after each test. The homepage sections follow
// docs/plans/homepage-sections-2026-10-28.md.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, expectNoHorizontalScroll, test } from './support/fixtures';

/**
 * The homepage sections by anchor, in page order (home-sections.constants.ts, SECTION_ANCHORS): each is a
 * `<section id=anchor>` labelled by its `h2#<anchor>-title`. The waitlist strip and the closing call to
 * action need the three NEXT_PUBLIC_WAITLIST_* / NEXT_PUBLIC_CONTACT_EMAIL variables at build time (dummy values are fine: the form is never submitted here).
 */
const ANCHORS = ['waitlist', 'how', 'who', 'app', 'privacy', 'faq'];

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
    for (const anchor of ANCHORS) {
      await expect(page.locator(`section#${anchor}[aria-labelledby="${anchor}-title"] h2#${anchor}-title`)).toHaveCount(
        1
      );
      await expect(page.locator(`section#${anchor} .section-eyebrow`)).toHaveCount(1);
    }
    await expect(page.locator('section#top[aria-labelledby="hero-title"] h1#hero-title')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('h2#cta-title')).toHaveCount(1);
    // No more blocks: the hero, the waitlist strip, five content sections and the closing call.
    await expect(page.locator('main > section')).toHaveCount(8);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toBeVisible();
  });

  for (const width of [320, 390]) {
    test(`landing ${path}: accessible and no sideways scroll at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page);
      // The whole page is scanned, hero phone mock-ups (.screens) included: axe finds no violation there now.
      // Scan after the hero entrance: mid-fade text reads as low contrast.
      await expect(page.locator('[data-anim="line"]').last()).toHaveCSS('opacity', '1');
      // `label-content-name-mismatch` is an experimental axe rule (off by default): the header link's
      // accessible name must contain its visible text ("Zapisz się", not "Dołącz do listy").
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'experimental'])
        .options({ rules: { 'label-content-name-mismatch': { enabled: true } } })
        .analyze();
      const serious = results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
      expect(serious).toEqual([]);
    });
  }
}

// "What it does today" sells Apple Health import, so the "being tested" strip under it may only name
// saving to Apple Health (not checked on a device yet).
for (const [path, imports, testing] of [
  ['/en', 'Import past walks', 'Saving to Apple Health'],
  ['/pl', 'Zaimportuj dawne spacery', 'Zapisywanie w Apple Health'],
] as const) {
  test(`landing ${path}: Apple Health is the same story in the tile and the status strip`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('.home-highlight-health')).toContainText(imports);
    await expect(page.locator('.home-status-testing')).toContainText(testing);
    await expect(page.locator('.home-status-notYet')).not.toContainText('Apple Health');
  });
}

// The header's section links (from 1024 px): they scroll the section's heading clear of the sticky
// header, and the link of the section being read is marked (aria-current="location").
/** Scrolls so the element sits 120 px from the top, as when a visitor reads down to it. */
const readAt = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluate((node) => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 120));

test.describe('header section links', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a link scrolls its heading below the sticky header', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // an instant jump, nothing to wait for
    await page.goto('/en');
    const nav = page.getByRole('navigation', { name: 'Page sections' });
    await expect(nav.getByRole('link')).toHaveText(['How it works', 'The app', 'Privacy', 'FAQ']);
    await nav.getByRole('link', { name: 'The app' }).click();
    await expect(page).toHaveURL(/#app$/);
    const header = await page.locator('header.app-header').boundingBox();
    await expect(async () => {
      const heading = await page.locator('h2#app-title').boundingBox();
      expect(heading?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
      expect(heading?.y).toBeLessThan(200);
    }).toPass();
  });

  test('the current link follows the scroll; the hero clears it, the page bottom marks the last', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');
    const nav = page.getByRole('navigation', { name: 'Page sections' });
    const current = nav.locator('a[aria-current="location"]');
    await expect(current).toHaveCount(0); // the hero
    await readAt(page, 'h2#how-title');
    await expect(current).toHaveText('How it works');
    await readAt(page, 'h2#privacy-title');
    await expect(current).toHaveText('Privacy');
    await readAt(page, 'h2#app-title');
    await expect(current).toHaveText('The app');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(current).toHaveText('FAQ');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(current).toHaveCount(0);
  });

  test('the Polish labels fit next to the button and the language switch at 1024 px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/pl');
    await expect(page.getByRole('navigation', { name: 'Sekcje strony' }).getByRole('link')).toHaveText([
      'Jak to działa',
      'Aplikacja',
      'Prywatność',
      'Pytania',
    ]);
    await expectNoHorizontalScroll(page);
    const inner = await page.locator('.app-header-inner').evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(inner).toBeLessThanOrEqual(0);
    // Nothing wraps: the bar stays one row.
    const rows = await page
      .locator('.app-header-nav a, .app-header-link, .lang')
      .evaluateAll((nodes) => new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().top / 4))).size);
    expect(rows).toBeLessThanOrEqual(2);
  });
});

test('phones get no section links, only the logo, the call to action and the language', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en');
  await expect(page.getByRole('navigation', { name: 'Page sections' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Waitlist', exact: true })).toBeVisible();
});

// A calm hero: on a 390 x 844 phone the badge, the tagline, the lede and the main button all sit on the first screen.
for (const path of ['/en', '/pl']) {
  test(`landing ${path}: badge, tagline, lede and the waitlist button fit the first screen at 390 x 844`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    for (const selector of ['.hero-badge', 'h1', '.hero-copy .lede', '.hero-actions .btn-primary']) {
      const box = await page.locator(selector).boundingBox();
      expect(box?.y, selector).toBeGreaterThan(0);
      expect((box?.y ?? 0) + (box?.height ?? 0), selector).toBeLessThanOrEqual(844);
    }
    // The brand is in the header: no second icon or wordmark in the hero.
    await expect(page.locator('.hero img.mark, .hero img.wordmark')).toHaveCount(0);
  });
}

// One card grammar, no orphan grids: the five highlight tiles are 3 + 2 from 720 px, and the step cards
// are three across from 1024 px (the turf legend's labels need the width) and stack below.
for (const width of [768, 1440]) {
  test(`landing: highlights are 3 + 2 and the step cards fit at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/en');
    const rows = async (selector: string) =>
      page.locator(selector).evaluateAll((nodes) => {
        const counts = new Map<number, number>();
        for (const node of nodes) {
          const top = Math.round(node.getBoundingClientRect().top);
          counts.set(top, (counts.get(top) ?? 0) + 1);
        }
        return [...counts.values()];
      });
    expect(await rows('.home-grid-highlights > li')).toEqual([3, 2]);
    expect(await rows('.home-steps > li')).toEqual(width < 1024 ? [1, 1, 1] : [3]);
    expect(await rows('.home-grid-3 > li')).toEqual([3]);
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
  // Step 4 at once, and it holds: autoplay (which would restart at step 0) never starts.
  await expect(player).toHaveAttribute('data-step', '4');
  const seen = await player.evaluate(
    (node) =>
      new Promise<string[]>((resolve) => {
        const steps = new Set<string>([node.getAttribute('data-step') ?? '']);
        const timer = setInterval(() => steps.add(node.getAttribute('data-step') ?? ''), 50);
        setTimeout(() => {
          clearInterval(timer);
          resolve([...steps]);
        }, 1500);
      })
  );
  expect(seen).toEqual(['4']);
});

test('FAQ: the structured data asks exactly the questions the page shows', async ({ page }) => {
  await page.goto('/pl');
  const shown = await page.locator('.home-faq-item summary').allTextContents();
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(ld['@type']).toBe('FAQPage');
  expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(shown);
});
