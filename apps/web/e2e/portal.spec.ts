// The signed-in portal, Slice 0 (sign-in and Privacy & data), against the API on PGlite through
// the site's own `/api/v1` route over HTTPS. Every test uses its own @e2e.cityturfer.test address.
import { CLIENT_HEADER, SESSION_COOKIE, SESSION_COOKIE_PATH, WRONG_CODE } from './support/constants';
import {
  expect,
  expectNoHorizontalScroll,
  expectNoSeriousAxe,
  requestCode,
  sessionCookie,
  signIn,
  signInHere,
  signInUi,
  test,
  testEmail,
} from './support/fixtures';

const DAY_S = 24 * 60 * 60;

test('the gate sends a signed-out visitor to sign-in, with no notice', async ({ page }) => {
  await page.goto('/en/account');
  await expect(page).toHaveURL(/\/en\/account\/sign-in$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to see your backup' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /signed out|session ended|erased/ })).toHaveCount(0);
});

test('code sign-in: a resend 429 leaves Sign in enabled, a wrong code is refused, the right one signs in', async ({
  page,
  context,
}) => {
  const email = testEmail('code');
  await page.goto('/en/account/sign-in');
  await requestCode(page, email);
  const ui = signInUi(page);

  // One code mail per address a minute: asking again at once is refused with a countdown.
  await ui.resend.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Too many tries for now.' })).toBeVisible();
  await expect(page.getByText(/Try again in \d+ seconds?\./)).toBeVisible();
  await expect(ui.resend).toBeDisabled();
  await expect(ui.submit).toBeEnabled();

  await ui.code.fill(WRONG_CODE);
  await ui.submit.click();
  await expect(page.getByRole('alert').filter({ hasText: 'That code is wrong or has expired.' })).toBeVisible();
  await expect(ui.code).toHaveAttribute('aria-invalid', 'true');
  expect(await sessionCookie(context)).toBeUndefined();

  await ui.code.fill('000000');
  const signedIn = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/sign-in'));
  await ui.submit.click();
  // The raw header: host-only (no Domain), whole site (Path=/), never readable by scripts.
  const setCookie = (await (await signedIn).headerValue('set-cookie')) ?? '';
  expect(setCookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
  expect(setCookie).toMatch(/; Path=\/(;|$)/);
  expect(setCookie).toMatch(/; HttpOnly/);
  expect(setCookie).toMatch(/; Secure/);
  expect(setCookie).toMatch(/; SameSite=Strict/);
  expect(setCookie).not.toMatch(/Domain=/i);
  await expect(page).toHaveURL(/\/en\/account$/);
  await expect(page.getByText(email).first()).toBeVisible();

  // The session is the HttpOnly, host-only cookie; JS sees nothing of it.
  const cookie = await sessionCookie(context);
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: SESSION_COOKIE_PATH });
  expect(cookie?.domain).toBe('localhost');
  expect(cookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + DAY_S);
  const storage = await page.evaluate(() => ({
    cookie: document.cookie,
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  expect(storage).toEqual({ cookie: '', local: 0, session: 0 });
});

test('the shared-computer box gives a session cookie (ends with the browser)', async ({ page, context }) => {
  await signIn(page, testEmail('shared'), { sharedComputer: true });
  const cookie = await sessionCookie(context);
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: SESSION_COOKIE_PATH });
  expect(cookie?.domain).toBe('localhost');
  expect(cookie?.expires).toBe(-1);
});

test('Privacy & data renders the backed-up copy and its empty state; axe; 320 px', async ({ page }) => {
  const email = testEmail('privacy');
  await signIn(page, email);
  for (const name of ['Your account', 'Backup', 'What we store', 'Signed-in devices', 'Get a copy']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Delete your account' })).toBeVisible();
  await expect(page.getByText('Nothing is backed up yet.', { exact: false })).toBeVisible();
  await expect(page.getByText('This shows the copy you backed up from your phone.', { exact: false })).toBeVisible();
  await expect(page.getByText('This browser', { exact: true })).toBeVisible();
  await expectNoSeriousAxe(page);

  await page.setViewportSize({ width: 320, height: 800 });
  await expectNoHorizontalScroll(page);
});

test('sign-in page: axe in both steps; 320 px', async ({ page }) => {
  await page.goto('/en/account/sign-in');
  await expect(signInUi(page).sendCode).toBeEnabled();
  await expectNoSeriousAxe(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await expectNoHorizontalScroll(page);

  await requestCode(page, testEmail('axe'));
  await expectNoSeriousAxe(page);
  await expectNoHorizontalScroll(page);
});

test('sign-out clears the cookie, and Back shows no data', async ({ page, context }) => {
  const email = testEmail('signout');
  await page.goto('/en');
  await signIn(page, email);
  await page.locator('.portal-header').getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/en\/account\/sign-in\?reason=signed-out$/);
  await expect(page.getByRole('status').filter({ hasText: "You're signed out." })).toBeVisible();
  expect(await sessionCookie(context)).toBeUndefined();

  // The portal pages replaced themselves, so Back leaves the portal; nothing personal anywhere.
  await page.goBack();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(email)).toHaveCount(0);
  await page.goForward();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(email)).toHaveCount(0);

  await page.goto('/en/account');
  await expect(page).toHaveURL(/\/en\/account\/sign-in$/);
  await expect(page.getByText(email)).toHaveCount(0);
});

test('a 401 mid-session goes to sign-in with "session ended" and drops the data', async ({ page, context }) => {
  const email = testEmail('expired');
  await signIn(page, email);
  // The session ends on the server's side (a revoked or expired token): the next call answers 401.
  const cookie = await sessionCookie(context);
  expect(cookie).toBeDefined();
  await context.addCookies([{ ...cookie!, value: 'no-longer-a-session' }]);

  await page.getByRole('button', { name: 'E-mail me a copy' }).click();
  await expect(page).toHaveURL(/\/en\/account\/sign-in\?reason=expired$/);
  await expect(page.getByRole('status').filter({ hasText: 'Your session ended.' })).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
});

test('?next: sign-in lands on the portal path it names', async ({ page }) => {
  await page.goto('/en/account/sign-in?next=%2Fpl%2Faccount');
  await signInHere(page, testEmail('next'));
  await expect(page).toHaveURL(/\/pl\/account$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Prywatność i dane' })).toBeVisible();
});

test('?next: a foreign URL falls back to the portal home', async ({ page }) => {
  await page.goto('/en/account/sign-in?next=https%3A%2F%2Fevil.example%2Fen%2Faccount');
  await signInHere(page, testEmail('evil'));
  await expect(page).toHaveURL(/^https:\/\/localhost:\d+\/en\/account$/);
});

test('delete account: erased notice, and the old session answers 401', async ({ page, context, baseURL }) => {
  const email = testEmail('delete');
  await signIn(page, email);
  const cookie = await sessionCookie(context);
  expect(cookie).toBeDefined();

  await page.getByRole('button', { name: 'Delete my account…' }).click();
  const confirm = page.getByRole('button', { name: 'Delete my account for good' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await confirm.click();

  await expect(page).toHaveURL(/\/en\/account\/sign-in\?reason=deleted$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'Your account and its backup here are erased.' })
  ).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);

  // Even with the old cookie put back, the API no longer knows this session.
  await context.addCookies([cookie!]);
  const me = await context.request.get(`${baseURL}/api/v1/me`, {
    headers: { [CLIENT_HEADER]: 'web/e2e', Origin: baseURL ?? '' },
  });
  expect(me.status()).toBe(401);
});
