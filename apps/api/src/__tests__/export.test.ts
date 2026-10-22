import { sql } from 'drizzle-orm';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BackupStore } from '../backup/ports';
import { DrizzleAccountRepository } from '../db/accounts';
import { DrizzleExportStore, PostgresFileStorage } from '../db/exports';
import { silentLog } from '../deps';
import { MemoryMailer } from '../identity/mailer';
import { EXPORT_PENDING_LEASE_MS, EXPORT_TTL_MS, ExportService } from '../privacy/use-cases';
import { backupApp, closeSharedDb, TOKENS, track, upload } from './support';

type Harness = Awaited<ReturnType<typeof backupApp>>;
let h: Harness;

const EMAIL = 'admin@cityturfer.com';

beforeEach(async () => {
  h = await backupApp();
  await h.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: true, policyVersion: '2026-10' } });
  const points = track(10).map((p, i) => [p[0], p[1], p[2], i < 5 ? 0 : 1, p[4]]);
  await h.call('PUT', '/v1/activities/run-1', { body: upload({ name: 'Old Town <loop> & back', track: { points } }) });
  await h.call('PUT', '/v1/activities/run-2', { body: upload() });
  await h.call('DELETE', '/v1/activities/run-2');
  await h.call('PUT', '/v1/turf/home-city', { body: { cityId: 'pl-warsaw', chosenAt: '2026-10-19T07:00:00Z' } });
});
afterEach(async () => {
  await h.close();
});
afterAll(closeSharedDb);

/** The download path in the last export e-mail. */
function linkPath(): string {
  const text = h.mailer.lastTo(EMAIL)?.text ?? '';
  const url = /http:\/\/localhost:8787(\/v1\/exports\/[A-Za-z0-9_-]+)/.exec(text)?.[1];
  if (!url) {
    throw new Error('no link');
  }
  return url;
}

describe('data export', () => {
  it('builds a zip with data.json and GPX, e-mails a link, and serves it until it expires', async () => {
    const res = await h.call('POST', '/v1/me/exports');
    expect(res.status).toBe(202);
    const job = await res.json();
    expect(job).toMatchObject({ status: 'ready', requestedAt: '2026-10-20T08:00:00.000Z' });
    expect(res.headers.get('location')).toBe(`/v1/me/exports/${job.id}`);
    expect(Date.parse(job.expiresAt) - Date.parse(job.requestedAt)).toBe(24 * 3600_000);

    const download = await h.call('GET', linkPath(), { token: null });
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('application/zip');
    expect(download.headers.get('cache-control')).toBe('no-store');
    const files = unzipSync(new Uint8Array(await download.arrayBuffer()));
    const data = JSON.parse(strFromU8(files['data.json']));
    expect(data).toMatchObject({
      account: { id: 'admin', email: EMAIL, hasPassword: false, passwordChangedAt: null },
      consents: [{ purpose: 'cloud-sync', granted: true }],
      activities: [{ id: 'run-1', name: 'Old Town <loop> & back' }],
      tombstones: [{ activityId: 'run-2' }],
      homeCity: { cityId: 'pl-warsaw' },
    });
    expect(data.activities[0].track.points).toHaveLength(10);
    const gpxName = Object.keys(files).find((f) => f.endsWith('.gpx'))!;
    expect(gpxName).toBe('activities/2026-10-19-run-1.gpx');
    // data.json is written across the whole build, so it is the last entry (see buildZip).
    expect(Object.keys(files).at(-1)).toBe('data.json');
    const gpx = strFromU8(files[gpxName]);
    expect(gpx).toContain('<gpx version="1.1" creator="CityTurfer" xmlns="http://www.topografix.com/GPX/1/1">');
    expect(gpx).toContain('<name>Old Town &lt;loop&gt; &amp; back</name>');
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
    expect(gpx.match(/<trkpt /g)).toHaveLength(10);

    // Repeatable until it expires (mail scanners, broken downloads); the status says it was fetched.
    const again = await h.call('GET', linkPath(), { token: null });
    expect(again.status).toBe(200);
    expect(unzipSync(new Uint8Array(await again.arrayBuffer()))['data.json']).toBeDefined();
    expect(await (await h.call('GET', `/v1/me/exports/${job.id}`)).json()).toMatchObject({ status: 'downloaded' });
  });

  it('allows one export per 24 hours (429 + Retry-After)', async () => {
    expect((await h.call('POST', '/v1/me/exports')).status).toBe(202);
    const second = await h.call('POST', '/v1/me/exports');
    expect(second.status).toBe(429);
    expect(Number(second.headers.get('retry-after'))).toBe(24 * 3600);
    h.clock.t += 24 * 3600_000;
    expect((await h.call('POST', '/v1/me/exports')).status).toBe(202);
  });

  it('expires the link after 24 hours (410) and reports it', async () => {
    const job = await (await h.call('POST', '/v1/me/exports')).json();
    h.clock.t += 24 * 3600_000 + 1;
    expect((await h.call('GET', linkPath(), { token: null })).status).toBe(410);
    expect(await (await h.call('GET', `/v1/me/exports/${job.id}`)).json()).toMatchObject({ status: 'expired' });
  });

  it('answers 404 for unknown keys and other users, 422 without an e-mail', async () => {
    const job = await (await h.call('POST', '/v1/me/exports')).json();
    expect((await h.call('GET', `/v1/exports/${'x'.repeat(43)}`, { token: null })).status).toBe(404);
    expect((await h.call('GET', `/v1/me/exports/${job.id}`, { token: TOKENS.other })).status).toBe(404);
    const noEmail = await h.call('POST', '/v1/me/exports', { token: TOKENS.other });
    expect(noEmail.status).toBe(422);
    expect(await noEmail.json()).toMatchObject({ code: 'export.no-email' });
  });

  it('serves the zip again after a broken (partial) download', async () => {
    await h.call('POST', '/v1/me/exports');
    const first = await h.call('GET', linkPath(), { token: null });
    const reader = first.body!.getReader();
    await reader.read();
    await reader.cancel();
    const retry = await h.call('GET', linkPath(), { token: null });
    expect(retry.status).toBe(200);
    expect(Object.keys(unzipSync(new Uint8Array(await retry.arrayBuffer())))).toContain('data.json');
  });

  it('marks the export failed and deletes its file when the e-mail cannot be sent; a retry is allowed', async () => {
    const failing = new MemoryMailer();
    failing.send = () => Promise.reject(new Error('mail down'));
    const f = await backupApp({ mailer: failing });
    await f.call('PUT', '/v1/me/consents/cloud-sync', { body: { granted: true, policyVersion: '2026-10' } });
    await f.call('PUT', '/v1/activities/run-1', { body: upload() });
    const res = await f.call('POST', '/v1/me/exports');
    expect(res.status).toBe(202);
    const job = await res.json();
    expect(job.status).toBe('failed');
    expect(await (await f.call('GET', `/v1/me/exports/${job.id}`)).json()).toMatchObject({ status: 'failed' });
    const left = await f.db.execute(sql`SELECT count(*)::int AS n FROM stored_files`);
    expect((left as unknown as { rows: { n: number }[] }).rows[0].n).toBe(0);
    expect((await f.call('POST', '/v1/me/exports')).status).toBe(202);
  });

  it('frees the slot of a build that was killed (pending past its lease)', async () => {
    // A request whose function timed out: reserved, never completed nor failed.
    const exports = new DrizzleExportStore(h.db);
    const stale = {
      id: 'exp_killed',
      status: 'pending' as const,
      requestedAt: h.clock.now(),
      readyAt: null,
      expiresAt: null,
      downloadedAt: null,
      fileKey: null,
      byteSize: null,
    };
    await exports.reserve('admin', stale, { windowMs: EXPORT_TTL_MS, leaseMs: EXPORT_PENDING_LEASE_MS });

    // Within the lease it may still be running: 429 until the lease ends, not for 24 h.
    h.clock.t += EXPORT_PENDING_LEASE_MS - 60_000;
    const early = await h.call('POST', '/v1/me/exports');
    expect(early.status).toBe(429);
    expect(Number(early.headers.get('retry-after'))).toBe(60);

    h.clock.t += 60_000;
    const res = await h.call('POST', '/v1/me/exports');
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ status: 'ready' });
    expect(await (await h.call('GET', '/v1/me/exports/exp_killed')).json()).toMatchObject({ status: 'failed' });
  });

  it('stops building once the zip passes the size limit, counting GPX output as it is made', async () => {
    for (let i = 0; i < 120; i += 1) {
      await h.call('PUT', `/v1/activities/run-${100 + i}`, { body: upload() });
    }
    let pages = 0;
    const counting: BackupStore = Object.assign(Object.create(h.store) as BackupStore, {
      read: (userId: string) => {
        const reader = h.store.read(userId);
        return Object.assign(Object.create(reader) as typeof reader, {
          changesSince: (after: number, limit: number) => {
            pages += 1;
            return reader.changesSince(after, limit);
          },
        });
      },
    });
    const mailer = new MemoryMailer();
    // Far below 50 GPX files, far above data.json's header: only GPX output can trip it.
    const service = new ExportService(
      counting,
      new DrizzleExportStore(h.db),
      new PostgresFileStorage(h.db),
      mailer,
      h.clock,
      'http://localhost:8787',
      silentLog,
      new DrizzleAccountRepository(h.db),
      5_000
    );
    expect(await service.request('admin')).toMatchObject({ status: 'failed' });
    // Three pages of 50 exist; the guard stopped after the first one.
    expect(pages).toBe(1);
    expect(mailer.lastTo(EMAIL)).toBeUndefined();
  });

  it('does not bring an export back when cloud-sync is withdrawn while the zip is built', async () => {
    const files = new PostgresFileStorage(h.db);
    const interleaved = Object.assign(Object.create(files) as PostgresFileStorage, {
      // The withdrawal lands between the build and the store: eraseBackup expires the pending row.
      put: async (...args: Parameters<PostgresFileStorage['put']>) => {
        const off = { body: { granted: false, policyVersion: '2026-10' } };
        expect((await h.call('PUT', '/v1/me/consents/cloud-sync', off)).status).toBe(200);
        return files.put(...args);
      },
    });
    const mailer = new MemoryMailer();
    const service = new ExportService(
      h.store,
      new DrizzleExportStore(h.db),
      interleaved,
      mailer,
      h.clock,
      'http://localhost:8787',
      silentLog,
      new DrizzleAccountRepository(h.db)
    );
    const job = await service.request('admin');
    expect(job.status).toBe('expired');
    expect(mailer.lastTo(EMAIL)).toBeUndefined();
    expect(await (await h.call('GET', `/v1/me/exports/${job.id}`)).json()).toMatchObject({ status: 'expired' });
    const left = await h.db.execute(sql`SELECT count(*)::int AS n FROM stored_files`);
    expect((left as unknown as { rows: { n: number }[] }).rows[0].n).toBe(0);
  });

  it('lets only one of two concurrent requests through (row lock)', async () => {
    const [a, b] = await Promise.all([h.call('POST', '/v1/me/exports'), h.call('POST', '/v1/me/exports')]);
    expect([a.status, b.status].sort()).toEqual([202, 429]);
  });

  it('is erased with the account', async () => {
    await h.call('POST', '/v1/me/exports');
    await h.call('DELETE', '/v1/me');
    for (const t of ['data_exports', 'stored_files']) {
      const r = await h.db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${t}"`));
      expect([t, (r as unknown as { rows: { n: number }[] }).rows[0].n]).toEqual([t, 0]);
    }
    expect((await h.call('GET', linkPath(), { token: null })).status).toBe(404);
  });
});
