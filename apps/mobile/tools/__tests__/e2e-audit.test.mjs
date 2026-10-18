import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  audit,
  collectSourceTestIds,
  commentedOutSteps,
  parseCriticalPaths,
  parseFlowsOrder,
  parseTags,
  sourceHasTestId,
} from '../e2e/audit.mjs';

const CONFIG = (flows) =>
  `flows:\n  - '*.yaml'\nexecutionOrder:\n  flowsOrder:\n${flows.map((f) => `    - ${f}`).join('\n')}\n`;
const FLOW = (tags, steps = "- tapOn: { id: 'a-button' }") => `appId: x\ntags: [${tags}]\n---\n${steps}\n`;

function fixture({ flows, order, md, src = "<B testID='a-button' />" }) {
  const root = mkdtempSync(join(tmpdir(), 'e2e-audit-'));
  mkdirSync(join(root, 'e2e/subflows'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'docs/quality'), { recursive: true });
  writeFileSync(join(root, 'e2e/config.yaml'), CONFIG(order ?? Object.keys(flows)));
  for (const [name, text] of Object.entries(flows)) writeFileSync(join(root, `e2e/${name}.yaml`), text);
  writeFileSync(join(root, 'e2e/.hidden.yaml'), 'ignored');
  writeFileSync(join(root, 'src/a.tsx'), src);
  writeFileSync(join(root, 'docs/quality/e2e.md'), md ?? '| CP-1 | thing | `01-a` | covered |\n');
  return root;
}

test('parsers', () => {
  assert.deepEqual(parseFlowsOrder(CONFIG(['a', 'b'])), ['a', 'b']);
  assert.deepEqual(parseTags(FLOW('auth, turf')), ['auth', 'turf']);
  assert.equal(commentedOutSteps('# prose\n  # - tapOn: x\n- ok').length, 1);
  assert.deepEqual(parseCriticalPaths('| CP-2 | x | `02-b`, `03-c` | ok |\n| other |'), [
    { id: 'CP-2', flows: ['02-b', '03-c'], unitOnly: false },
  ]);
});

test('source testID matching handles templates', () => {
  const ids = collectSourceTestIds("testID='x' testID={`item-${i}`} tabBarButtonTestID: 'tab-a'");
  assert.ok(sourceHasTestId(ids, 'x'));
  assert.ok(sourceHasTestId(ids, 'item-0'));
  assert.ok(sourceHasTestId(ids, 'tab-a'));
  assert.ok(!sourceHasTestId(ids, 'nope'));
});

test('clean fixture passes; dotfiles and subflows are ignored', () => {
  const root = fixture({ flows: { '01-a': FLOW('auth'), '08-sign-out': FLOW('auth') } });
  assert.deepEqual(audit(root).errors, []);
});

test('flow missing from config, and config entry without flow', () => {
  const root = fixture({
    flows: { '01-a': FLOW('auth'), '08-sign-out': FLOW('auth') },
    order: ['01-a', 'ghost', '08-sign-out'],
  });
  const e = audit(root).errors.join('\n');
  assert.match(e, /ghost but e2e\/ghost\.yaml does not exist/);
  const root2 = fixture({ flows: { '01-a': FLOW('auth'), '08-sign-out': FLOW('auth') }, order: ['08-sign-out'] });
  assert.match(audit(root2).errors.join('\n'), /01-a\.yaml is not in config\.yaml/);
});

test('sign-out must be last', () => {
  const root = fixture({
    flows: { '01-a': FLOW('auth'), '08-sign-out': FLOW('auth') },
    order: ['08-sign-out', '01-a'],
  });
  assert.match(audit(root).errors.join('\n'), /08-sign-out must be last/);
});

test('bad tag, commented-out step, unknown testID', () => {
  const root = fixture({
    flows: { '01-a': FLOW('wat', "# - tapOn: 'x'\n- tapOn: { id: 'missing-id' }"), '08-sign-out': FLOW('auth') },
  });
  const e = audit(root).errors.join('\n');
  assert.match(e, /tag "wat"/);
  assert.match(e, /commented-out step/);
  assert.match(e, /testID "missing-id"/);
});

test('critical path mapping: unknown flow fails, unit-only is allowed', () => {
  const flows = { '01-a': FLOW('auth'), '08-sign-out': FLOW('auth') };
  const bad = fixture({ flows, md: '| CP-1 | x | `99-nope` | y |\n| CP-2 | x | none | y |\n' });
  const e = audit(bad).errors.join('\n');
  assert.match(e, /CP-1: flow 99-nope does not exist/);
  assert.match(e, /CP-2: maps to no flow/);
  const ok = fixture({ flows, md: '| CP-1 | x | `01-a` | y |\n| CP-2 | x | unit-only | gap |\n' });
  assert.deepEqual(audit(ok).errors, []);
});

test('real repository passes the audit', async () => {
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); // apps/mobile
  assert.deepEqual(audit(root, resolve(root, '../..')).errors, []);
});
