import { deviceTokenAuth, parseApiTokens } from './auth/device-tokens';
import { createNeonDb } from './db/neon';
import { DrizzleBackupStore } from './db/store';
import { type ApiDeps, defaultDeps, jsonLineLog } from './deps';

/**
 * Production wiring from environment variables (Vercel → Settings → Environment Variables):
 * - `API_TOKENS`: JSON object sha256(token) hex → userId (device tokens; missing → every token 401).
 * - `DATABASE_URL`: Neon pooled connection string (missing → live data routes answer 503).
 * Nothing secret is logged: only whether each is configured and how many token entries were skipped.
 */
export function productionDeps(env: NodeJS.ProcessEnv): ApiDeps {
  const tokens = parseApiTokens(env.API_TOKENS);
  if (tokens.skipped > 0 || tokens.entries.length === 0) {
    process.stdout.write(
      `${JSON.stringify({ msg: 'config', apiTokens: tokens.entries.length, apiTokensSkipped: tokens.skipped })}\n`
    );
  }
  const store = env.DATABASE_URL ? new DrizzleBackupStore(createNeonDb(env.DATABASE_URL).db) : null;
  return defaultDeps({ auth: deviceTokenAuth(tokens.entries), log: jsonLineLog, store });
}
