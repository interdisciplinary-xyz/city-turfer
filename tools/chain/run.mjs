#!/usr/bin/env node
// The sync chain (docs/plans/sync-chain-testing-2026-10-22.md): starts the API on a free port with
// an in-memory PGlite database (never apps/api/.data, never Neon), runs the phone's chain scenarios
// against it and against the fake API, checks the API's log holds no coordinates, and lists the
// checks that could not run yet apart from the passes.
//
//   pnpm test:chain                 # all chain scenarios
//   pnpm test:chain -- -t S11       # extra arguments go to Jest
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/**
 * The fixed sign-in code. The API accepts it for @e2e.cityturfer.test addresses and, on the local
 * PGlite server only, for the mock accounts admin@ and demo@cityturfer.com (the local profile
 * backup scenarios rely on that; never in production).
 */
const CODE = '000000';

/** Numbers shaped like a coordinate (a degree with 4+ decimals): none may reach the API's log. */
export function findCoordinates(text) {
  return text.split('\n').filter((line) => /-?\b\d{1,3}\.\d{4,}\b/.test(line));
}

/** Pending lines (CHAIN_REPORT, one JSON object each) grouped for the summary. */
export function summarisePending(jsonl) {
  return jsonl
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((p) => `  - [${p.server}] ${p.check}: ${p.pending}`);
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function waitForHealth(base, api) {
  for (let i = 0; i < 120; i++) {
    if (api.exitCode != null) {
      throw new Error(`the API exited with ${api.exitCode}`);
    }
    try {
      const res = await fetch(`${base}/v1/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('the API did not answer /v1/health within 60 s');
}

/** The last lines of the API's output, for a start-up failure (no coordinates exist yet then). */
export function tail(text, lines = 40) {
  return text.split('\n').slice(-lines).join('\n');
}

async function main() {
  const work = mkdtempSync(path.join(tmpdir(), 'cityturfer-chain-'));
  const report = path.join(work, 'pending.jsonl');
  let api = null;
  let jest = null;
  let stopped = false;
  /** Stops the Jest and API process groups (pnpm → jest workers, pnpm → tsx → node) and removes the work folder. */
  const cleanUp = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    // Both run under pnpm (and Jest has worker processes): stop each whole process group.
    for (const child of [jest, api]) {
      if (child?.pid && child.exitCode == null) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          child.kill('SIGTERM');
        }
      }
    }
    rmSync(work, { recursive: true, force: true });
  };
  // Ctrl+C or a CI cancel: never leave an API with the fixed sign-in code running.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => {
      process.stderr.write(`chain: ${signal}, stopping Jest and the API\n`);
      cleanUp();
      process.exit(130);
    });
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let apiLog = '';
  const env = {
    ...process.env,
    API_HOST: '127.0.0.1',
    PORT: String(port),
    PGLITE_DIR: 'memory',
    AUTH_FIXED_CODE: CODE,
  };
  delete env.DATABASE_URL; // a chain run never touches a real database
  delete env.API_TOKENS;
  api = spawn('pnpm', ['--filter', '@cityturfer/api', 'exec', 'tsx', 'src/server.ts'], {
    cwd: ROOT,
    env,
    detached: true,
  });
  api.stdout.on('data', (d) => (apiLog += d));
  api.stderr.on('data', (d) => (apiLog += d));

  let code = 1;
  let pending = [];
  try {
    try {
      await waitForHealth(base, api);
    } catch (e) {
      process.stderr.write(`chain: ${e.message}. The API's last output:\n${tail(apiLog)}\n`);
      throw e;
    }
    process.stdout.write(`chain: API on ${base} (PGlite in memory)\n`);
    code = await new Promise((resolve) => {
      jest = spawn(
        'pnpm',
        [
          '-C',
          'apps/mobile',
          'exec',
          'jest',
          'src/__tests__/chain',
          ...process.argv.slice(2).filter((a) => a !== '--'),
        ],
        {
          cwd: ROOT,
          stdio: 'inherit',
          detached: true,
          env: { ...process.env, CITYTURFER_LIVE_API: base, CITYTURFER_LIVE_CODE: CODE, CHAIN_REPORT: report },
        }
      );
      jest.on('exit', (c) => resolve(c ?? 1));
    });
    try {
      pending = summarisePending(readFileSync(report, 'utf8'));
    } catch {
      // no pending checks
    }
  } finally {
    cleanUp();
  }

  const leaks = findCoordinates(apiLog);
  if (leaks.length > 0) {
    process.stderr.write(`chain: ${leaks.length} API log line(s) look like they hold coordinates (not shown)\n`);
    code = code || 1;
  } else {
    process.stdout.write('chain: API log checked, no coordinates\n');
    if (code !== 0) {
      // Checked above to hold no coordinates, so the API's own view of a failed run can be shown.
      process.stderr.write(`chain: tests failed. The API's last output:\n${tail(apiLog)}\n`);
    }
  }
  if (pending.length > 0) {
    process.stdout.write(`chain: ${pending.length} check(s) pending, not passed:\n${pending.join('\n')}\n`);
  }
  process.exit(code);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write(`chain: ${e.message}\n`);
    process.exit(1);
  });
}
