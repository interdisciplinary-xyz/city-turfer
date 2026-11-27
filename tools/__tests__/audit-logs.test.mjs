import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { auditSource, auditTree, TREES } from '../audit-logs.mjs';

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

test('error reports whose arguments name coordinates fail', () => {
  assert.deepEqual(rules("reporter.report(error, { area: 'territory', lat: p.lat });"), ['report-coords']);
  assert.deepEqual(rules("c.errorReporter.report(e, {\n  area: 'planner',\n  firstLng: w.lng,\n});"), [
    'report-coords',
  ]);
  assert.deepEqual(rules('await c.var.deps.reportError?.(err, { requestId, waypoints });'), ['report-coords']);
  assert.deepEqual(rules('Sentry.captureException(error, { extra: { coords } });'), ['report-coords']);
  assert.deepEqual(rules('client.captureMessage(`failed at ${fix.latitude}`);'), ['report-coords']);
});

test('error reports with labels, codes and other words pass', () => {
  assert.deepEqual(auditSource('toast.reporter.report(error, { area: o.area, code: o.code });'), []);
  assert.deepEqual(auditSource("reporter.report(error, { area: 'territory', code: 'coords-load' });"), []);
  assert.deepEqual(auditSource("Sentry.captureException(error, { tags: { latency: '2', planet: 'x' } });"), []);
  assert.deepEqual(auditSource('// reporter.report(e, { lat })\nresult.report.count;'), []);
  assert.deepEqual(
    auditSource("// audit-logs-allow: lat is a test fixture name\nreporter.report(e, { area: 'x', lat });"),
    []
  );
});

test('a tree can run a subset of the rules (the API and web run only report-coords)', () => {
  assert.deepEqual(auditSource("console.log('x');", { rules: ['report-coords'] }), []);
  assert.deepEqual(auditSource("diagnostics.log('x', { lat: 1 });", { rules: ['report-coords'] }), []);
  assert.deepEqual(
    auditSource('reporter.report(e, { lat });', { rules: ['report-coords'] }).map((f) => f.rule),
    ['report-coords']
  );
});

test('the real trees are clean', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  for (const { dir, rules: treeRules } of TREES) {
    assert.deepEqual(auditTree(join(root, dir), { rules: treeRules }), [], dir);
  }
});
