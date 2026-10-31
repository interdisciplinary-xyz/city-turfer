import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

// The CHANGELOG preset reads issue refs out of commit bodies. With the default prefix `#`, hex
// colours (`#9AA3B5`, `#C8`) became fake "closes" links in the v0.14.0 dry run. `.versionrc.json`
// limits refs to `#` + digits; this runs the installed parser with that config.
const require = createRequire(import.meta.url);
const parser = require('conventional-commits-parser');
const parserOpts = require('conventional-changelog-conventionalcommits/parser-opts.js');
const versionrc = require('../../.versionrc.json');

const issues = (message, issuePrefixes) =>
  parser.sync(message, parserOpts({ issuePrefixes })).references.map((ref) => ref.issue);

const BODY = 'fix(brand): muted text\n\nfrom #9AA3B5 to #ADB5C5, scrim #C8 on #EEF1F7\n\nCloses #194 (#198)';

test('the default prefix turns hex colours into issue refs (the bug this config prevents)', () => {
  assert.ok(issues(BODY, ['#']).includes('9AA3B5'));
});

test('.versionrc.json keeps real issue and PR refs and drops hex colours', () => {
  assert.deepEqual(issues(BODY, versionrc.issuePrefixes), ['194', '198']);
});

test('a number followed by letters is not a ref', () => {
  assert.deepEqual(issues('fix: x\n\ncolour #123abc, see #7', versionrc.issuePrefixes), ['7']);
});
