import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditAll,
  auditAppCatalogue,
  auditWebCatalogue,
  checkMessage,
  flatten,
  pluralCategories,
} from '../i18n-audit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'i18n-audit-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

let n = 0;
/** A fresh repo root holding `files` ({ 'apps/mobile/messages/en/record.json': {...} }). */
function tree(files) {
  const root = join(tmp, String(n++));
  for (const [path, value] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value));
  }
  mkdirSync(root, { recursive: true });
  return root;
}
const lines = (findings) => findings.map((f) => `${f.file} ${f.key}: ${f.message}`);

const PL_PLURAL = '{count, plural, one {# aktywność} few {# aktywności} many {# aktywności} other {# aktywności}}';
const EN_PLURAL = '{count, plural, one {# activity} other {# activities}}';

test('plural categories come from CLDR in canonical order', () => {
  assert.deepEqual(pluralCategories('en'), ['one', 'other']);
  assert.deepEqual(pluralCategories('pl'), ['one', 'few', 'many', 'other']);
});

test('a complete Polish and English plural passes', () => {
  assert.deepEqual(checkMessage(PL_PLURAL, 'pl').findings, []);
  assert.deepEqual(checkMessage(EN_PLURAL, 'en').findings, []);
});

test('a Polish plural without few or many fails; exact =0 does not stand in for a category', () => {
  assert.deepEqual(checkMessage('{n, plural, one {# km} other {# km}}', 'pl').findings, [
    'plural {n} lacks few, many (pl needs one, few, many, other)',
  ]);
  assert.deepEqual(checkMessage('{n, plural, =0 {none} =1 {one} other {#}}', 'en').findings, [
    'plural {n} lacks one (en needs one, other)',
  ]);
});

test('a plural nested in a select is checked too', () => {
  const msg = '{type, select, walk {{n, plural, one {# spacer} other {# spacerów}}} other {x}}';
  assert.deepEqual(checkMessage(msg, 'pl').findings, ['plural {n} lacks few, many (pl needs one, few, many, other)']);
});

test('false positives: # in a plural, nested select, apostrophes, escapes and tags parse cleanly', () => {
  const ok = [
    ['{count, plural, one {# day} other {# days}}', 'en'],
    ['{type, select, walk {Walk} run {Run} cycle {Ride} other {Activity}}', 'en'],
    ['{type, select, walk {{n, plural, one {# walk} other {# walks}}} other {{n, number}}}', 'en'],
    ["Don't stop: it's your turf", 'en'],
    ["Use '{braces}' literally and '' a quote", 'en'],
    ['Number #1 outside a plural', 'en'],
    ['Read the <link>privacy policy</link>', 'en'],
    ['Distance {distance} · pace {pace} /km', 'en'],
    ['Ulice są Twoje — „cudzysłów” i 2,50 km', 'pl'],
  ];
  for (const [msg, locale] of ok) {
    assert.deepEqual(checkMessage(msg, locale).findings, [], msg);
  }
});

test('invalid ICU is reported', () => {
  assert.match(checkMessage('Hello {name', 'en').findings[0], /^not valid ICU/);
  assert.match(checkMessage('{n, plural, one {#}}', 'en').findings[0], /^not valid ICU/); // no `other`
  assert.match(checkMessage('<b>bold', 'en').findings[0], /^not valid ICU/);
});

test('flatten: nested keys, empty strings, non-string values, dotted keys, empty objects', () => {
  const { leaves, findings } = flatten({ a: { b: 'x', c: '' }, d: 3, e: ['x'], 'f.g': 'y', h: {}, i: null });
  assert.deepEqual([...leaves.keys()], ['a.b', 'a.c', 'f.g']);
  assert.deepEqual(
    findings.map((f) => `${f.key}: ${f.message}`),
    [
      'a.c: empty string',
      'd: value is number, not a string or object',
      'e: value is an array, not a string or object',
      'f.g: key contains "." (use-intl reads it as nesting)',
      'h: empty object',
      'i: value is object, not a string or object',
    ]
  );
  assert.deepEqual(flatten(['x']).findings, [{ key: '(root)', message: 'file is not a JSON object' }]);
});

test('no app catalogue yet passes with a note', () => {
  const root = tree({});
  assert.deepEqual(auditAppCatalogue(root), { findings: [], notes: ['apps/mobile/messages: no app catalogue yet'] });
});

test('a matching app catalogue passes', () => {
  const root = tree({
    'apps/mobile/messages/en/record.json': { start: 'Start {type}', count: EN_PLURAL },
    'apps/mobile/messages/pl/record.json': { start: 'Rozpocznij {type}', count: PL_PLURAL },
    'apps/mobile/messages/en/common.json': { ok: 'OK' },
    'apps/mobile/messages/pl/common.json': { ok: 'OK' },
  });
  assert.deepEqual(auditAppCatalogue(root).findings, []);
});

test('app: missing and extra namespace files and keys, per locale with the key path', () => {
  const root = tree({
    'apps/mobile/messages/en/record.json': { start: 'Start', nested: { a: 'A', b: 'B' } },
    'apps/mobile/messages/en/turf.json': { title: 'Turf' },
    'apps/mobile/messages/pl/record.json': { start: 'Start', nested: { a: 'A', c: 'C' } },
    'apps/mobile/messages/pl/extra.json': { x: 'X' },
    'apps/mobile/messages/notes.json': {},
  });
  assert.deepEqual(lines(auditAppCatalogue(root).findings).sort(), [
    'apps/mobile/messages/notes.json (file): stray file: messages go in <locale>/<namespace>.json',
    'apps/mobile/messages/pl/extra.json (file): extra (not in en)',
    'apps/mobile/messages/pl/record.json nested.b: missing (en has it)',
    'apps/mobile/messages/pl/record.json nested.c: extra (not in en)',
    'apps/mobile/messages/pl/turf.json (file): missing (en has it)',
  ]);
});

test('app: placeholders and select options must match the source', () => {
  const root = tree({
    'apps/mobile/messages/en/record.json': {
      a: 'Start {type}',
      b: '{type, select, walk {Walk} run {Run} cycle {Ride} other {Go}}',
      c: 'Read <link>this</link>',
      d: 'Same {x} {y}',
    },
    'apps/mobile/messages/pl/record.json': {
      a: 'Rozpocznij {typ}',
      b: '{type, select, walk {Spacer} run {Bieg} other {Start}}',
      c: 'Przeczytaj to',
      d: 'Inna kolejność {y} {x}',
    },
  });
  assert.deepEqual(lines(auditAppCatalogue(root).findings), [
    'apps/mobile/messages/pl/record.json a: placeholders typ differ from en: type',
    'apps/mobile/messages/pl/record.json b: select {type} options other, run, walk differ from en: cycle, other, run, walk',
    'apps/mobile/messages/pl/record.json c: placeholders (none) differ from en: <link>',
  ]);
});

test('app: invalid JSON and a missing source locale are findings', () => {
  const root = tree({ 'apps/mobile/messages/pl/record.json': '{ "a": ' });
  const found = lines(auditAppCatalogue(root).findings);
  assert.equal(found[0], 'apps/mobile/messages/en/ (folder): source locale missing');
  assert.match(found[1], /^apps\/mobile\/messages\/pl\/record\.json \(file\): not valid JSON/);
});

test('website: one file per locale, compared with en', () => {
  const root = tree({
    'apps/web/messages/en.json': { hero: { title: 'Hi', wait: '{count, plural, one {# s} other {# s}}' } },
    'apps/web/messages/pl.json': { hero: { title: '', wait: '{count, plural, one {# s} other {# s}}' } },
  });
  assert.deepEqual(lines(auditWebCatalogue(root).findings), [
    'apps/web/messages/pl.json hero.title: empty string',
    'apps/web/messages/pl.json hero.wait: plural {count} lacks few, many (pl needs one, few, many, other)',
  ]);
});

test('the repo catalogues pass', () => {
  assert.deepEqual(lines(auditAll(ROOT).findings), []);
});
