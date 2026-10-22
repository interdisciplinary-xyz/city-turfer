import { sql } from 'drizzle-orm';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

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
  it('builds a zip with data.json and GPX, e-mails a one-time link, and serves it once', async () => {
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
      account: { id: 'admin', email: EMAIL },
      consents: [{ purpose: 'cloud-sync', granted: true }],
      activities: [{ id: 'run-1', name: 'Old Town <loop> & back' }],
      tombstones: [{ activityId: 'run-2' }],
      homeCity: { cityId: 'pl-warsaw' },
    });
    expect(data.activities[0].track.points).toHaveLength(10);
    const gpxName = Object.keys(files).find((f) => f.endsWith('.gpx'))!;
    expect(gpxName).toBe('activities/2026-10-19-run-1.gpx');
    const gpx = strFromU8(files[gpxName]);
    expect(gpx).toContain('<gpx version="1.1" creator="CityTurfer" xmlns="http://www.topografix.com/GPX/1/1">');
    expect(gpx).toContain('<name>Old Town &lt;loop&gt; &amp; back</name>');
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
    expect(gpx.match(/<trkpt /g)).toHaveLength(10);

    const again = await h.call('GET', linkPath(), { token: null });
    expect(again.status).toBe(410);
    expect(await again.json()).toMatchObject({ code: 'export.gone' });
    expect(await (await h.call('GET', `/v1/me/exports/${job.id}`)).json()).toMatchObject({ status: 'downloaded' });
    // The file is gone from storage once served.
    const left = await h.db.execute(sql`SELECT count(*)::int AS n FROM stored_files`);
    expect((left as unknown as { rows: { n: number }[] }).rows[0].n).toBe(0);
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
