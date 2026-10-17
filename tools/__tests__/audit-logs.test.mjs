import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { auditSource, auditTree } from '../audit-logs.mjs';

const rules = (src) => auditSource(src).map((f) => f.rule);

test('inline, brace-less and block __DEV__ guards pass', () => {
  assert.deepEqual(auditSource("if (__DEV__) console.warn('x', e);"), []);
  assert.deepEqual(auditSource("if (__DEV__ && flag) console.warn('x');"), []);
  assert.deepEqual(auditSource("if (__DEV__)\n  console.warn('x');"), []);
  assert.deepEqual(auditSource('if (__DEV__) {\n  const a = { b: 1 };\n  console.log(a);\n}'), []);
});

test('unguarded console.* fails with the line number', () => {
  const f = auditSource("const a = 1;\nconsole.log('x');\n");
  assert.deepEqual(
    f.map((x) => [x.line, x.rule]),
    [[2, 'console']]
  );
  assert.deepEqual(rules("console.warn('x');"), ['console']);
  assert.deepEqual(rules("console.error('x');"), ['console']);
});

test('a negated or unrelated guard does not count; guard scope ends with the block', () => {
  assert.deepEqual(rules("if (!__DEV__) console.warn('x');"), ['console']);
  assert.deepEqual(rules("if (ready) console.warn('x');"), ['console']);
  assert.deepEqual(rules("if (__DEV__) {\n  a();\n}\nconsole.log('after');"), ['console']);
});

test('comments mentioning console are ignored', () => {
  assert.deepEqual(auditSource("// console.log('x')\n/* console.log('y') */\n/*\n console.log('z')\n*/"), []);
});

test('allow-list needs a justification', () => {
  assert.deepEqual(auditSource("// audit-logs-allow: CLI tool output, not shipped\nconsole.log('x');"), []);
  assert.deepEqual(auditSource("console.log('x'); // audit-logs-allow: dev seeding progress"), []);
  assert.deepEqual(rules("// audit-logs-allow:\nconsole.log('x');"), ['allow-justification']);
});

test('diagnostics.log payloads with coordinate words fail', () => {
  assert.deepEqual(rules("diagnostics.log('batch', { lat: 1 });"), ['diagnostics-coords']);
  assert.deepEqual(rules("c.diagnostics.log('batch', { firstLon: p.lon });"), ['diagnostics-coords']);
  assert.deepEqual(rules("c?.diagnostics.log('batch', { coords: x.coords });"), ['diagnostics-coords']);
  assert.deepEqual(rules("diagnostics.log('x', { start_latitude: 1 });"), ['diagnostics-coords']);
  assert.deepEqual(rules("diagnostics.log(\n  'batch',\n  {\n    longitude: 1,\n  }\n);"), ['diagnostics-coords']);
  assert.deepEqual(rules("diagnostics.log('x', { coordinate: 1 });"), ['diagnostics-coords']);
});

test('counts, states and substrings of other words pass', () => {
  assert.deepEqual(
    auditSource(
      "diagnostics.log('batch', { received: n, accepted: a, appState, colon: 1, latency: 2, ...result.report });"
    ),
    []
  );
  assert.deepEqual(auditSource("diagnostics.log('launch', { lowPowerMode: false });"), []);
});

test('diagnostics.log allow-list works', () => {
  assert.deepEqual(
    auditSource(
      "// audit-logs-allow: coords here is a count of coordinate systems, not a position\ndiagnostics.log('x', { coords: 3 });"
    ),
    []
  );
});

test('the real src/ tree is clean', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  assert.deepEqual(auditTree(join(root, 'src')), []);
});
