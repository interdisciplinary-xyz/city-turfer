#!/usr/bin/env node
/**
 * Publish the latest finished EAS `android-apk` build to the website's download link.
 *
 *   BLOB_READ_WRITE_TOKEN=… pnpm -C apps/mobile run android:publish [--build <eas-build-id>]
 *
 * 1. Finds the newest finished build of the `android-apk` profile (or the one given).
 * 2. Downloads its APK and prints the SHA-256 (put it in the release notes).
 * 3. Uploads it to Vercel Blob twice: `android/cityturfer.apk` (stable; the website's
 *    NEXT_PUBLIC_ANDROID_APK_URL points here, so set it once) and
 *    `android/cityturfer-<version>-<versionCode>.apk` (kept for history).
 *
 * The token comes from the Blob store's settings on Vercel; keep it in your shell or an
 * untracked .env file, never in git (tools/check-secret-files.mjs blocks .env files).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import { put } from '@vercel/blob';

const args = process.argv.slice(2);
const buildArg = args.includes('--build') ? args[args.indexOf('--build') + 1] : null;
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('BLOB_READ_WRITE_TOKEN is not set (Vercel → Storage → your Blob store → .env.local).');
  process.exit(2);
}

const eas = (...a) =>
  JSON.parse(
    execFileSync('pnpm', ['dlx', 'eas-cli@latest', ...a, '--json', '--non-interactive'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
  );

const build = buildArg
  ? eas('build:view', buildArg)
  : eas(
      'build:list',
      '--platform',
      'android',
      '--build-profile',
      'android-apk',
      '--status',
      'finished',
      '--limit',
      '1'
    )[0];
if (!build?.artifacts?.buildUrl) {
  console.error('No finished android-apk build with an artifact found.');
  process.exit(1);
}

const { appVersion, appBuildVersion, id } = build;
console.log(`Build ${id}: ${appVersion} (versionCode ${appBuildVersion})`);
const res = await fetch(build.artifacts.buildUrl);
if (!res.ok) {
  throw new Error(`Download failed: HTTP ${res.status}`);
}
const apk = Buffer.from(await res.arrayBuffer());
const sha256 = createHash('sha256').update(apk).digest('hex');
console.log(`APK ${(apk.length / 1048576).toFixed(1)} MB, SHA-256 ${sha256}`);

const options = {
  access: 'public',
  token,
  contentType: 'application/vnd.android.package-archive',
  addRandomSuffix: false,
  allowOverwrite: true,
};
const versioned = await put(`android/cityturfer-${appVersion}-${appBuildVersion}.apk`, apk, options);
// The stable name is overwritten on every publish; a short cache keeps the download fresh.
const latest = await put('android/cityturfer.apk', apk, { ...options, cacheControlMaxAge: 60 });
console.log(`Versioned: ${versioned.url}`);
console.log(`Latest:    ${latest.url}   ← NEXT_PUBLIC_ANDROID_APK_URL`);
