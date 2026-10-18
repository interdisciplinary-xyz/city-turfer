import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { check, classify } from '../check-secret-files.mjs';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '../check-secret-files.mjs');

test('blocks personal location data', () => {
  for (const p of [
    'a.db',
    'SQLite/turftrack-user.db',
    'x.sqlite',
    'x.sqlite3',
    'turf.db-wal',
    'turf.db-shm',
    'diag.logarchive',
    'diag.logarchive/Info.plist',
    'walk.gpx',
    'docs/morning-run.gpx',
    'apps/mobile/tools/fixtures/history/2026-01-01.gpx',
    'e2e-results/20261015/report.xml',
  ]) {
    assert.equal(classify(p)?.level, 'block', p);
  }
});

test('blocks signing material and credentials', () => {
  for (const p of [
    'AuthKey_X.p8',
    'dist.p12',
    'a.cer',
    'x.mobileprovision',
    'credentials.json',
    'android/app/google-services.json',
    'google-services-prod.json',
    'GoogleService-Info.plist',
    'upload.jks',
    '.env',
    '.env.local',
    'apps/.env.production',
  ]) {
    assert.equal(classify(p)?.level, 'block', p);
  }
});

test('allows fixtures, examples and ordinary files', () => {
  for (const p of [
    'apps/mobile/tools/fixtures/run-5k.gpx',
    '.env.example',
    'apps/mobile/src/platform/database.ts',
    'apps/mobile/src/contexts/recording/db-adapter.ts',
    'docs/quality/e2e.md',
    'apps/mobile/e2e/01-auth.yaml',
    'package.json',
  ]) {
    assert.equal(classify(p), null, p);
  }
});

test('warns on .DS_Store without blocking', () => {
  assert.equal(classify('.DS_Store')?.level, 'warn');
  assert.equal(classify('src/.DS_Store')?.level, 'warn');
  const r = check(['src/.DS_Store', 'package.json']);
  assert.equal(r.blocked.length, 0);
  assert.equal(r.warned.length, 1);
});

test('check separates blocked from warned', () => {
  const r = check(['walk.gpx', '.DS_Store', 'ok.ts']);
  assert.deepEqual(
    r.blocked.map((b) => b.path),
    ['walk.gpx']
  );
  assert.deepEqual(
    r.warned.map((b) => b.path),
    ['.DS_Store']
  );
});

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'secret-guard-'));
  const run = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  run('init', '-q');
  return { dir, run };
}

test('CLI: staged secret exits 1, clean exits 0, .DS_Store warns', () => {
  const { dir, run } = repo();
  mkdirSync(join(dir, 'apps/mobile/tools/fixtures'), { recursive: true });
  writeFileSync(join(dir, 'apps/mobile/tools/fixtures/ok.gpx'), '<gpx/>');
  writeFileSync(join(dir, '.DS_Store'), '');
  run('add', '-f', '.');
  let r = spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /\.DS_Store/);

  writeFileSync(join(dir, 'trace.gpx'), '<gpx/>');
  run('add', 'trace.gpx');
  r = spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /trace\.gpx/);
});

test('CLI: --tracked catches a force-added database; outside a repo fails loudly (exit 2)', () => {
  const { dir, run } = repo();
  writeFileSync(join(dir, 'user.db'), '');
  run('add', '-f', 'user.db');
  assert.equal(spawnSync('node', [SCRIPT, '--tracked'], { cwd: dir }).status, 1);
  const outside = mkdtempSync(join(tmpdir(), 'not-a-repo-'));
  assert.equal(
    spawnSync('node', [SCRIPT], { cwd: outside, env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() } }).status,
    2
  );
});
