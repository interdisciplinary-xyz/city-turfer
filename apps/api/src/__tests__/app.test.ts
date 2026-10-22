import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { defaultDeps, type RequestLogEntry, silentLog } from '../deps';
import { API_VERSION, OPENAPI_CONFIG } from '../spec';
import { backupApp, closeSharedDb, TOKENS } from './support';

/** Spec and planned routes: no database, the placeholder auth (any bearer token, never verified). */
const app = createApp(defaultDeps({ log: silentLog }));
const AUTH = { Authorization: 'Bearer test-token' };
const PUBLIC = new Set(['getHealth', 'signIn']);
/** The one-way backup (docs/decisions/api-sync-2026-10-20.md): live since 0.3.0. */
const LIVE = new Set([
  'getHealth',
  'getMe',
  'listConsents',
  'setConsent',
  'listChanges',
  'listActivities',
  'uploadActivity',
  'getActivity',
  'deleteActivity',
  'getActivityTrack',
  'saveGapRoutes',
  'getHomeCity',
  'chooseHomeCity',
]);

/** Live routes on PGlite with real device tokens. */
let live: Awaited<ReturnType<typeof backupApp>>;
const LIVE_AUTH = { Authorization: `Bearer ${TOKENS.admin}` };
beforeAll(async () => {
  live = await backupApp();
});
afterAll(async () => {
  await live.close();
  await closeSharedDb();
});
const METHODS = ['get', 'put', 'post', 'patch', 'delete'] as const;

type Operation = {
  operationId?: string;
  tags?: string[];
  security?: Record<string, string[]>[];
  responses?: Record<string, unknown>;
  'x-cityturfer-status'?: string;
};

function operations(doc: { paths?: Record<string, Record<string, Operation>> }) {
  return Object.entries(doc.paths ?? {}).flatMap(([p, item]) =>
    METHODS.filter((m) => item[m]).map((m) => ({ path: p, method: m, op: item[m] }))
  );
}

describe('routes', () => {
  it('answers health without auth', async () => {
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      version: API_VERSION,
      coreVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      database: 'not-configured',
    });
  });

  it('answers planned routes with a 501 problem', async () => {
    const res = await app.request('/v1/turf/summary', { headers: AUTH });
    expect(res.status).toBe(501);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ status: 501, code: 'not-implemented' });
  });

  it('validates input before a planned handler, without echoing it back', async () => {
    const res = await app.request('/v1/turf/cells?bbox=21.0122,52.2297&zoom=13', { headers: AUTH });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ status: 400, code: 'invalid-request' });
    // Location data is personal data: never repeat coordinates in an error.
    expect(JSON.stringify(body)).not.toContain('52.2297');
  });

  it('refuses live routes to an unverified caller (placeholder auth) with 401', async () => {
    const res = await app.request('/v1/me', { headers: AUTH });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'auth.invalid' });
  });

  it('refuses 7-column track points on a live upload', async () => {
    const point = (i: number) => [21.0122 + i * 1e-4, 52.2297, 1760857920000 + i * 3000, 0, 98.5];
    const body = {
      type: 'run',
      name: 'Morning run',
      source: 'recording',
      startedAt: '2026-10-19T07:12:00Z',
      endedAt: '2026-10-19T07:42:00Z',
      resumedSegments: null,
      track: { points: [point(0), point(1)] },
    };
    const put = (b: unknown) =>
      live.app.request('/v1/activities/3f9c2a64', {
        method: 'PUT',
        headers: { ...LIVE_AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
      });
    const old = await put({
      ...body,
      track: {
        points: [
          [...point(0), 5, 2.9],
          [...point(1), 5, 2.9],
        ],
      },
    });
    expect(old.status).toBe(400);
    expect(JSON.stringify(await old.json())).not.toContain('52.2297');
  });

  it('rejects an activity upload with a bad id or body', async () => {
    const res = await live.app.request('/v1/activities/not%20an%20id', {
      method: 'PUT',
      headers: { ...LIVE_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'swim' }),
    });
    expect(res.status).toBe(400);
  });

  it('answers unknown paths with a 404 problem', async () => {
    const res = await app.request('/v1/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'not-found' });
  });

  it('serves the spec and Swagger UI', async () => {
    expect((await app.request('/openapi.json')).status).toBe(200);
    const ui = await app.request('/swagger');
    expect(ui.status).toBe(200);
    const html = await ui.text();
    expect(html).toContain('swagger');
    expect(html).toContain('showExtensions');
  });
});

describe('platform middleware', () => {
  const upload = (headers: Record<string, string>, body: BodyInit) =>
    live.app.request('/v1/activities/3f9c2a64', { method: 'PUT', headers, body });

  it('answers 401 before validating, so an anonymous caller learns nothing about the schema', async () => {
    const res = await upload({ 'Content-Type': 'application/json' }, '{}');
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
    expect(await res.json()).toMatchObject({ status: 401, code: 'auth.missing' });
  });

  it('answers 401 auth.invalid when the verifier rejects the token', async () => {
    const strict = createApp(defaultDeps({ log: silentLog, auth: { verify: () => Promise.resolve(null) } }));
    const res = await strict.request('/v1/me', { headers: AUTH });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'auth.invalid' });
  });

  it('lists at most 20 invalid fields', async () => {
    const points = Array.from({ length: 100 }, (_, i) => [21.0122, 52.2297, 1760857920000 + i, 0, 'x']);
    const res = await upload(
      { ...LIVE_AUTH, 'Content-Type': 'application/json' },
      JSON.stringify({ type: 'run', track: { points } })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toHaveLength(20);
    expect(body.detail).toContain('more');
  });

  it('lists invalid fields as JSON pointers', async () => {
    const res = await upload({ ...LIVE_AUTH, 'Content-Type': 'application/json' }, JSON.stringify({ type: 'swim' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toContainEqual(expect.objectContaining({ pointer: '/type' }));
  });

  it('inflates gzip bodies before validation', async () => {
    const res = await upload(
      { ...LIVE_AUTH, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
      gzipSync(JSON.stringify({ type: 'swim' }))
    );
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toContainEqual(expect.objectContaining({ pointer: '/type' }));
  });

  it('refuses other encodings with 415 and oversized bodies with 413', async () => {
    const br = await upload({ ...LIVE_AUTH, 'Content-Type': 'application/json', 'Content-Encoding': 'br' }, '{}');
    expect(br.status).toBe(415);
    const big = await upload({ ...LIVE_AUTH, 'Content-Type': 'application/json' }, 'x'.repeat(4_600_000));
    expect(big.status).toBe(413);
    expect(await big.json()).toMatchObject({ code: 'payload-too-large' });
  });

  it('gives every answer a request id and logs the route pattern, never the path', async () => {
    const entries: RequestLogEntry[] = [];
    const logged = createApp(defaultDeps({ log: { request: (e) => entries.push(e) } }));
    const res = await logged.request('/v1/turf/claims/3f9c2a64', { headers: AUTH });
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(entries).toEqual([
      expect.objectContaining({ method: 'GET', route: '/v1/turf/claims/:activityId', status: 501 }),
    ]);
    expect(JSON.stringify(entries)).not.toContain('3f9c2a64');
  });
});

describe('OpenAPI document', () => {
  const doc = app.getOpenAPI31Document(OPENAPI_CONFIG);
  const ops = operations(doc as never);

  it('is OpenAPI 3.1 with every route of the decision record', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(ops).toHaveLength(22);
  });

  it('gives every operation a unique id and a bounded-context tag', () => {
    const ids = ops.map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(ops.length);
    for (const o of ops) {
      expect(o.op.tags?.length).toBeGreaterThan(0);
    }
  });

  it('requires bearer auth everywhere except the public routes', () => {
    for (const o of ops) {
      const id = o.op.operationId!;
      expect([id, o.op.security]).toEqual([id, PUBLIC.has(id) ? [] : [{ bearerAuth: [] }]]);
    }
  });

  it('marks the backup routes live (503 without a database) and the rest planned (501)', () => {
    for (const o of ops) {
      const id = o.op.operationId!;
      if (LIVE.has(id)) {
        expect([id, o.op['x-cityturfer-status']]).toEqual([id, undefined]);
        expect([id, Object.hasOwn(o.op.responses ?? {}, '503')]).toEqual([id, !PUBLIC.has(id)]);
      } else {
        expect([id, o.op['x-cityturfer-status']]).toEqual([id, 'planned']);
        expect(o.op.responses).toHaveProperty('501');
      }
    }
  });

  it('matches the committed apps/api/openapi.json (run `pnpm --filter @cityturfer/api run openapi`)', () => {
    const committed = readFileSync(path.join(import.meta.dirname, '..', '..', 'openapi.json'), 'utf8');
    expect(committed).toBe(`${JSON.stringify(doc, null, 2)}\n`);
  });
});
