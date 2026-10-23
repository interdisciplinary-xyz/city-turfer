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
