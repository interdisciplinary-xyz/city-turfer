#!/usr/bin/env node
/**
 * `pnpm run check:secret-files` refuses to let personal location data or signing material enter a
 * commit. `.gitignore` is not a leak boundary: it does not stop `git add -f`. Mirrors empatalk's
 * scripts/tools/check-secret-files.mjs.
 *
 *   (default)   STAGED files (pre-commit hook, runs before lint-staged)
 *   --tracked   every TRACKED file (CI)
 *
 * BLOCK (exit 1): SQLite databases and journals (a user's SQLite DB holds their whole location
 * history), log archives, GPX traces outside apps/mobile/tools/fixtures/, Maestro results (e2e-results/),
 * signing material and store credentials, .env files other than .env.example.
 * WARN (exit 0): .DS_Store.
 *
 * Fails loudly (exit 2) if git itself cannot run: a guard that passes when its tooling breaks
 * manufactures confidence.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Synthetic routes committed on purpose (apps/mobile/tools/gen-route.mjs output). */
const GPX_ALLOWED = /^apps\/mobile\/tools\/fixtures\/[^/]+\.gpx$/i;

export const BLOCK_RULES = [
  { re: /\.(db|db3|sqlite|sqlite3)$/i, what: 'SQLite database (personal location data)' },
  { re: /\.sqlite[^/]*$/i, what: 'SQLite file (personal location data)' },
  { re: /-(wal|shm)$/i, what: 'SQLite journal (personal location data)' },
  { re: /\.logarchive(\/|$)/i, what: 'device log archive (personal location data)' },
  { re: /\.gpx$/i, what: 'GPX trace outside apps/mobile/tools/fixtures/ (personal location data)', allow: GPX_ALLOWED },
  { re: /(^|\/)e2e-results\//, what: 'Maestro result (screenshots may show real locations)' },
  { re: /\.(p8|p12|pfx|cer|mobileprovision|keystore|jks|pem|key)$/i, what: 'signing material' },
  { re: /(^|\/)(credentials\.json|service-account[^/]*\.json)$/i, what: 'store or service credentials' },
  { re: /(^|\/)google-services[^/]*\.json$/i, what: 'Firebase config (not used by the PoC)' },
  { re: /(^|\/)GoogleService-Info\.plist$/i, what: 'Firebase config (not used by the PoC)' },
  { re: /(^|\/)\.env(\.[^/]+)?$/i, what: 'environment file', allow: /(^|\/)\.env\.example$/i },
];

export const WARN_RULES = [{ re: /(^|\/)\.DS_Store$/, what: 'macOS folder metadata' }];

/** @returns {{ level: 'block' | 'warn', what: string } | null} */
export function classify(path) {
  const p = path.replace(/\\/g, '/');
  for (const r of BLOCK_RULES) {
    if (r.re.test(p) && !(r.allow && r.allow.test(p))) {
      return { level: 'block', what: r.what };
    }
  }
  for (const r of WARN_RULES) {
    if (r.re.test(p)) {
      return { level: 'warn', what: r.what };
    }
  }
  return null;
}

export function check(paths) {
  const blocked = [];
  const warned = [];
  for (const path of paths) {
    const c = classify(path);
    if (c?.level === 'block') {
      blocked.push({ path, what: c.what });
    } else if (c?.level === 'warn') {
      warned.push({ path, what: c.what });
    }
  }
  return { blocked, warned };
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\0')
      .filter(Boolean);
  } catch (error) {
    console.error(`secret-file guard could not run: git ${args.join(' ')}`);
    console.error(`  ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    process.exit(2);
  }
}

function main() {
  const tracked = process.argv.includes('--tracked');
  const paths = tracked
    ? git(['ls-files', '-z'])
    : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
  const { blocked, warned } = check(paths);
  for (const w of warned) {
    console.warn(`warning: ${w.path} (${w.what}) should not be committed`);
  }
  if (blocked.length) {
    console.error(
      `Refusing to ${tracked ? 'pass' : 'commit'}: ${blocked.length} file(s) look like secrets or personal data:`
    );
    for (const b of blocked) {
      console.error(`  - ${b.path}  [${b.what}]`);
    }
    console.error('Unstage with `git restore --staged <file>` (or `git rm --cached <file>` if tracked).');
    process.exit(1);
  }
  console.log(`secret-file guard ok (${paths.length} ${tracked ? 'tracked' : 'staged'} file(s) checked)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
