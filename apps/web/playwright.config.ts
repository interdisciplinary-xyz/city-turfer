// Portal E2E (Playwright, Chromium): the built static export served over HTTPS like Vercel serves
// it, with the `/api/v1/*` route to the API on an in-memory PGlite (e2e/support/*.mjs). Not part of
// `test:unit` or CI by default: it needs a browser (`pnpm exec playwright install chromium`) and a
// build made WITH the waitlist variables: the landing tests look for the header's join link, the
// waitlist strip (#waitlist) and the closing call to action, which exist only when
// NEXT_PUBLIC_WAITLIST_FORM_URL, NEXT_PUBLIC_WAITLIST_CONTROLLER and NEXT_PUBLIC_CONTACT_EMAIL are
// set at build time. `pnpm --filter @cityturfer/web run test:e2e` builds with dummy example.invalid
// values (test:e2e:build, the form is never submitted) and runs the suite; `test:e2e:run` only runs it
// against the existing out/. Not part of CI (ci:quality) yet.
import { defineConfig, devices } from '@playwright/test';

import { E2E_CLIENT_IP, E2E_CODE } from './e2e/support/constants';

const SITE_PORT = Number(process.env.E2E_SITE_PORT ?? 4431);
const API_PORT = Number(process.env.E2E_API_PORT ?? 8797);
const SITE_ORIGIN = `https://localhost:${SITE_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  outputDir: './e2e-results',
  use: {
    baseURL: SITE_ORIGIN,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    locale: 'en-GB',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'api',
      command: 'node --import tsx e2e/support/api-server.mjs',
      url: `http://127.0.0.1:${API_PORT}/v1/health`,
      env: {
        PORT: String(API_PORT),
        WEB_ORIGIN: SITE_ORIGIN,
        AUTH_FIXED_CODE: E2E_CODE,
      },
      reuseExistingServer: false,
      stdout: 'ignore',
      timeout: 60_000,
    },
    {
      name: 'site',
      command: 'node e2e/support/site-server.mjs',
      url: `${SITE_ORIGIN}/en`,
      ignoreHTTPSErrors: true,
      env: {
        PORT: String(SITE_PORT),
        API_URL: `http://127.0.0.1:${API_PORT}`,
        E2E_CLIENT_IP: E2E_CLIENT_IP,
      },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
