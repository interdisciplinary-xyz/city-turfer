import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { OPENAPI_CONFIG } from '../spec';

const app = createApp();
const AUTH = { Authorization: 'Bearer test-token' };
const PUBLIC = new Set(['getHealth', 'signIn', 'searchCities']);
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
    expect(await res.json()).toEqual({ status: 'ok', version: '0.1.0' });
  });

  it('answers planned routes with a 501 problem', async () => {
    const res = await app.request('/v1/me', { headers: AUTH });
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

  it('rejects an activity upload with a bad id or body', async () => {
    const res = await app.request('/v1/activities/not%20an%20id', {
      method: 'PUT',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
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
    expect(await ui.text()).toContain('swagger');
  });
});

describe('OpenAPI document', () => {
  const doc = app.getOpenAPI31Document(OPENAPI_CONFIG);
  const ops = operations(doc as never);

  it('is OpenAPI 3.1 with every route of the decision record', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(ops).toHaveLength(20);
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

  it('marks every route but health as planned, with a 501 answer', () => {
    for (const o of ops.filter((x) => x.op.operationId !== 'getHealth')) {
      expect(o.op['x-cityturfer-status']).toBe('planned');
      expect(o.op.responses).toHaveProperty('501');
    }
  });

  it('matches the committed apps/api/openapi.json (run `pnpm --filter @cityturfer/api run openapi`)', () => {
    const committed = readFileSync(path.join(import.meta.dirname, '..', '..', 'openapi.json'), 'utf8');
    expect(committed).toBe(`${JSON.stringify(doc, null, 2)}\n`);
  });
});
