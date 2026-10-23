// Shared by playwright.config.ts and the specs (Playwright loads them as CommonJS: `__dirname`).
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** The code every @e2e.cityturfer.test address signs in with (AUTH_FIXED_CODE; never in production). */
export const E2E_CODE = '000000';

/** A code that is never right. */
export const WRONG_CODE = '123456';

/** Test accounts live here only (apps/api TEST_EMAIL_DOMAIN). */
export const E2E_EMAIL_DOMAIN = 'e2e.cityturfer.test';

/**
 * The visitor address the E2E "edge" forwards (TEST-NET-3). The API's sign-in limits count per IP;
 * the API's database is in memory, so nothing carries over between runs.
 */
export const E2E_CLIENT_IP = '203.0.113.10';

/** The site's version header on unsafe API calls (src/api/client.ts). */
export const CLIENT_HEADER = 'CityTurfer-Client';

const spec = JSON.parse(readFileSync(path.join(__dirname, '../../../api/openapi.json'), 'utf8')) as {
  components: { securitySchemes: { cookieAuth: { name: string } } };
};

/** The website's session cookie, as the contract names it (`cookieAuth`). */
export const SESSION_COOKIE = spec.components.securitySchemes.cookieAuth.name;

/** A `__Host-` cookie is always `Path=/` (the browser refuses it otherwise). */
export const SESSION_COOKIE_PATH = '/';
