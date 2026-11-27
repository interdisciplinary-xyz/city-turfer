// The homepage on a build WITHOUT the waitlist variables (pnpm run test:e2e:closed): the hero's primary
// button reads "How to get it" and still lands on #join, which shows the stage and one honest line and
// no form, no email field and no "stored in the EU" point (docs/plans/homepage-value-2026-11-19.md §3).
// Skipped on the default build (with the variables), where landing.spec.ts runs.
import { expect, test } from './support/fixtures';
import { expectHeadingBelowHeader } from './support/landing';

test.skip(!process.env.E2E_NO_WAITLIST, 'needs a build without NEXT_PUBLIC_WAITLIST_* (test:e2e:closed)');

for (const [path, primary, secondary, closed] of [
  ['/en', 'How to get it', 'See how it works', 'The waitlist opens here soon'],
  ['/pl', 'Jak dołączyć', 'Zobacz, jak to działa', 'Wkrótce otworzymy tu listę oczekujących'],
] as const) {
  test(`closed ${path}: both hero buttons land on sections, #join has no form`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await expect(page.locator('main > section')).toHaveCount(7);
    await expect(page.locator('section#join form')).toHaveCount(0);
    await expect(page.locator('section#join')).toContainText(closed);
    await expect(page.locator('section#join .home-status-strip')).toBeVisible();
    await expect(page.locator('section#join .trust-row li')).toHaveCount(3);
    await expect(page.locator('section#join .trust-row')).not.toContainText(/EU|UE/);
    await expect(page.locator('footer.site-footer a[href^="mailto:"]')).toHaveCount(0);
    await page.locator('.hero-actions').getByRole('link', { name: primary, exact: true }).click();
    await expect(page).toHaveURL(/#join$/);
    await expectHeadingBelowHeader(page, 'section#join h2#join-title');
    await page.goto(path);
    await page.locator('.hero-actions').getByRole('link', { name: secondary, exact: true }).click();
    await expect(page).toHaveURL(/#how$/);
    await expectHeadingBelowHeader(page, 'section#how h2#how-title');
  });
}
