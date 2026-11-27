// Helpers shared by the landing specs.
import { expect, type Page } from '@playwright/test';

/**
 * The heading sits clear of the sticky header after an in-page jump (`scroll-padding-top` on html plus
 * the section's scroll-margin): its top edge is under the bar's bottom edge, and still on screen.
 */
export async function expectHeadingBelowHeader(page: Page, selector: string) {
  const header = await page.locator('header.app-header').boundingBox();
  const bottom = (header?.y ?? 0) + (header?.height ?? 0);
  await expect(async () => {
    const heading = await page.locator(selector).boundingBox();
    expect(heading?.y).toBeGreaterThanOrEqual(bottom);
    expect(heading?.y).toBeLessThan(page.viewportSize()?.height ?? 0);
  }).toPass({ timeout: 5000 });
}
