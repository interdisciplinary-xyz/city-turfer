import assert from 'node:assert/strict';
import { test } from 'node:test';

import { frontmatterError, parseFrontmatter } from '../docs-audit.mjs';

const doc = (yaml) => `---\n${yaml}\n---\n\n# Body\n`;

test('folded and literal block scalars read as their text, not as ">-" or "|"', () => {
  const folded = parseFrontmatter(doc('name: x\ndescription: >-\n  Builds the server side: apps/api,\n  then more.'));
  assert.equal(folded.description, 'Builds the server side: apps/api, then more.');
  const literal = parseFrontmatter(doc('summary: |\n  line one\n  line two'));
  assert.equal(literal.summary, 'line one\nline two\n');
});

test('reads the docs contract: plain values, dates as strings, flow and block lists', () => {
  const fm = parseFrontmatter(
    doc('status: canonical\nverified: 2026-10-20\nowner: founder\nscope: [apps/api, docs]\nsummary: "Quoted: yes"')
  );
  assert.deepEqual(fm, {
    status: 'canonical',
    verified: '2026-10-20',
    owner: 'founder',
    scope: ['apps/api', 'docs'],
    summary: 'Quoted: yes',
  });
  assert.deepEqual(parseFrontmatter(doc('scope:\n  - a\n  - b')).scope, ['a', 'b']);
});

test('no frontmatter is null; invalid YAML is reported and still read leniently', () => {
  assert.equal(parseFrontmatter('# Just a doc\n'), null);
  assert.equal(frontmatterError('# Just a doc\n'), null);
  const broken = doc('name: x\ndescription:\n  Builds the server\n  side: apps/api.');
  assert.match(frontmatterError(broken), /./);
  assert.equal(parseFrontmatter(broken).name, 'x');
  // false positive guard: valid YAML has no error
  assert.equal(frontmatterError(doc('description: >-\n  a: b')), null);
});
