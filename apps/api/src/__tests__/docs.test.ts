import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { defaultDeps, silentLog } from '../deps';
import { OPENAPI_CONFIG } from '../spec';

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..');
const RECORD = 'docs/decisions/api-sync-2026-10-20.md';
const METHODS = ['get', 'put', 'post', 'patch', 'delete'] as const;

const doc = createApp(defaultDeps({ log: silentLog })).getOpenAPI31Document(OPENAPI_CONFIG) as unknown as {
  paths: Record<string, Record<string, { 'x-cityturfer-status'?: string }>>;
};

const specRoutes = Object.entries(doc.paths).flatMap(([p, item]) =>
  METHODS.filter((m) => item[m]).map((m) => ({
    route: `${m.toUpperCase()} ${p}`,
    status: item[m]['x-cityturfer-status'] === 'planned' ? 'planned' : 'live',
  }))
);

/** Rows of the "v1 routes" table: `| \`METHOD /path\` | use case | status |`. */
function recordRoutes(): { route: string; status: string }[] {
  const text = readFileSync(path.join(ROOT, RECORD), 'utf8');
  const section = text.slice(text.indexOf('## v1 routes'), text.indexOf('\n## ', text.indexOf('## v1 routes') + 1));
  return [...section.matchAll(/^\|\s*`([A-Z]+ \/v1\/[^`]*)`\s*\|[^|]*\|\s*(\w+)\s*\|/gm)].map((m) => ({
    route: m[1],
    status: m[2],
  }));
}

describe(`the route table in ${RECORD}`, () => {
  it('lists exactly the operations of the spec, with their status', () => {
    const sort = (xs: { route: string; status: string }[]) => [...xs].sort((a, b) => a.route.localeCompare(b.route));
    expect(sort(recordRoutes())).toEqual(sort(specRoutes));
  });
});

/** Every number pair in an example that looks like [lon, lat] (bbox strings included). */
function coordinatePairs(value: unknown, out: [number, number][] = []): [number, number][] {
  if (typeof value === 'string' && /^-?\d+\.\d+(,-?\d+\.\d+){3}$/.test(value)) {
    const [w, s, e, n] = value.split(',').map(Number);
    out.push([w, s], [e, n]);
  } else if (Array.isArray(value)) {
    const [a, b, c, d] = value;
    const isFraction = (x: unknown) => typeof x === 'number' && !Number.isInteger(x);
    if (isFraction(a) && isFraction(b) && Math.abs(a) <= 180 && Math.abs(b) <= 90) {
      out.push([a, b]);
      if (value.length === 4 && isFraction(c) && isFraction(d)) {
        out.push([c, d]); // bounding box
      }
    }
    value.forEach((v) => coordinatePairs(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => coordinatePairs(v, out));
  }
  return out;
}

function examples(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    node.forEach((n) => examples(n, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'example' || k === 'examples') {
        out.push(v);
      } else {
        examples(v, out);
      }
    }
  }
  return out;
}

describe('spec examples', () => {
  it('use only public landmarks: every coordinate lies around central Warsaw', () => {
    const pairs = coordinatePairs(examples(doc));
    expect(pairs.length).toBeGreaterThan(5);
    for (const [lon, lat] of pairs) {
      expect([lon, lat, lon >= 20.8 && lon <= 21.2 && lat >= 52.1 && lat <= 52.4]).toEqual([lon, lat, true]);
    }
  });
});
