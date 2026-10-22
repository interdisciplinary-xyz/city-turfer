// Portal E2E (Playwright, Chromium): the built static export served over HTTPS like Vercel serves
// it, with the `/api/v1/*` route to the API on an in-memory PGlite (e2e/support/*.mjs). Not part of
// `test:unit` or CI by default: it needs a browser (`pnpm exec playwright install chromium`) and a
// fresh `pnpm --filter @cityturfer/web build`. Run: `pnpm --filter @cityturfer/web run test:e2e`.
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
