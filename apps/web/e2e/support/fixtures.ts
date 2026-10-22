// The portal E2E's `test`: every page records its requests, and each test ends by checking the
// network allow-list (self only: the site and its `/api/v1` route; no tiles in Slice 0), that no
// URL carries an e-mail address, and that the CSP blocked nothing.
import { randomBytes } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, type Page, test as base } from '@playwright/test';

import { E2E_CODE, E2E_EMAIL_DOMAIN, SESSION_COOKIE } from './constants';

type Network = {
  /** Every request URL the context made, in order. */
  urls: string[];
  /** Every response that tried to set a cookie (`url`). */
  setCookies: string[];
};

export const test = base.extend<{ network: Network }>({
  network: [
    async ({ context, baseURL }, use) => {
      const network: Network = { urls: [], setCookies: [] };
      const cspViolations: string[] = [];
      context.on('request', (request) => network.urls.push(request.url()));
      context.on('response', async (response) => {
        if ((await response.headerValue('set-cookie')) !== null) {
          network.setCookies.push(response.url());
        }
      });
      context.on('console', (message) => {
        if (/Content Security Policy/i.test(message.text())) {
          cspViolations.push(message.text());
        }
      });
      await use(network);
      const self = new URL(baseURL ?? '').origin;
      const foreign = network.urls.filter((url) => !/^(data|blob|about):/.test(url) && new URL(url).origin !== self);
      expect(foreign, 'requests outside the allow-list (self only)').toEqual([]);
      expect(
        network.urls.filter((url) => decodeURIComponent(url).includes(`@${E2E_EMAIL_DOMAIN}`)),
        'an e-mail address in a URL'
      ).toEqual([]);
      expect(cspViolations, 'CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** A fresh test address per call: the API allows one code mail per address a minute. */
export function testEmail(name: string): string {
  return `${name}-${randomBytes(4).toString('hex')}@${E2E_EMAIL_DOMAIN}`;
}

export const signInUi = (page: Page) => ({
  email: page.getByLabel('E-mail address'),
  sendCode: page.getByRole('button', { name: 'E-mail me a code' }),
  code: page.getByLabel('6-digit code'),
  sharedComputer: page.getByLabel('This is a shared computer'),
  submit: page.getByRole('button', { name: 'Sign in', exact: true }),
  resend: page.getByRole('button', { name: 'Send the code again' }),
});

/** Asks for a code on the sign-in page already open, and waits for the code step. */
export async function requestCode(page: Page, email: string) {
  const ui = signInUi(page);
  await ui.email.fill(email);
  await ui.sendCode.click();
  await expect(ui.code).toBeVisible();
}

/** From the sign-in page already open: e-mail, code, optional shared-computer box, Sign in. */
export async function signInHere(page: Page, email: string, { sharedComputer = false } = {}) {
  await requestCode(page, email);
  const ui = signInUi(page);
  await ui.code.fill(E2E_CODE);
  if (sharedComputer) {
    await ui.sharedComputer.check();
  }
  await ui.submit.click();
}

/** Signs in from the English sign-in page and waits for Privacy & data. */
export async function signIn(page: Page, email: string, options: { sharedComputer?: boolean } = {}) {
  await page.goto('/en/account/sign-in');
  await signInHere(page, email, options);
  await expect(page).toHaveURL(/\/en\/account$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy & data' })).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
}

export async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE);
}

/** axe (WCAG 2.1 A/AA): no serious or critical findings. */
export async function expectNoSeriousAxe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
  expect(serious).toEqual([]);
}

/** The page never scrolls sideways (320 px phones). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
