import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SURFACES } from '../brand/surfaces.mjs';
import {
  applyKnown,
  audit,
  brandFamilies,
  brandHexes,
  copyFindings,
  literalFindings,
  logoFindings,
  manifestFindings,
} from '../brand-audit.mjs';

const CTX = {
  hexes: new Set(['#7B2FF7', '#F72FA8']),
  families: new Set(['BigShouldersDisplay-Black', 'Barlow']),
  fontFiles: new Set(['Barlow-Regular.woff2', 'BigShouldersDisplay-Black.woff2']),
};
const rules = (findings) => findings.map((f) => `${f.level}:${f.rule}`);

test('brand hex and brand rgb channels are errors, other hex a warning', () => {
  const css = 'a { color: #f72fa8; }\nb { color: rgba(247, 47, 168, 0.4); }\nc { color: #123456; }';
  assert.deepEqual(rules(literalFindings('apps/web/src/x.css', css, CTX)), [
    'error:brand-hex',
    'warning:hex',
    'error:brand-rgb',
  ]);
});

test('anchors and allowlisted native config are not colours', () => {
  assert.deepEqual(literalFindings('apps/web/src/x.tsx', '<a href="#7B2FF7">', CTX), []);
  assert.deepEqual(literalFindings('apps/mobile/app.json', '{"backgroundColor": "#7B2FF7"}', CTX), []);
});

test('a scheme chosen by name is an error; SITE_SCHEME is fine', () => {
  const bad = "cssVariables('light'); THEMES.dark; THEMES['light']";
  assert.equal(literalFindings('apps/web/src/x.ts', bad, CTX).filter((f) => f.rule === 'named-scheme').length, 3);
  assert.deepEqual(literalFindings('apps/web/src/x.ts', 'cssVariables(SITE_SCHEME); THEMES[SITE_SCHEME]', CTX), []);
});

test('@font-face must use a brand family and a file from packages/brand/fonts', () => {
  const ok = "@font-face { font-family: 'Barlow'; src: url('./fonts/Barlow-Regular.woff2') format('woff2'); }";
  assert.deepEqual(literalFindings('apps/storybook/.storybook/x.html', ok, CTX), []);
  const bad = "@font-face { font-family: 'Inter'; src: url('./fonts/Inter.woff2'); }";
  assert.deepEqual(rules(literalFindings('apps/storybook/.storybook/x.html', bad, CTX)), [
    'error:font-face',
    'error:font-face',
  ]);
  const missing = "src: '../../packages/brand/fonts/Barlow-Black.woff2'";
  assert.deepEqual(rules(literalFindings('apps/web/src/app/fonts.ts', missing, CTX)), ['error:font-face']);
});

test('the name is CityTurfer; domains and packages stay lower case', () => {
  const text = 'Welcome to City Turfer. Cityturfer is great. Visit cityturfer.local or @cityturfer/brand. CityTurfer!';
  assert.deepEqual(
    copyFindings('apps/api/src/guide.ts', text).map((f) => f.message),
    ['"City Turfer": the name is CityTurfer', '"Cityturfer": the name is CityTurfer']
  );
});

test('"territory" is banned in English catalogue values, not in keys or Polish', () => {
  const en = JSON.stringify({ territory: { title: 'Your turf', body: 'Claim new territory' } });
  const found = copyFindings('apps/web/messages/en.json', en, { english: true });
  assert.deepEqual(
    found.map((f) => `${f.rule} ${f.key}`),
    ['territory territory.body']
  );
  const pl = JSON.stringify({ territory: { body: 'Twoje terytorium' } });
  assert.deepEqual(copyFindings('apps/web/messages/pl.json', pl), []);
});

test('logo copies: identical warns, different is drift', () => {
  const originals = [['mark.svg', '<svg>a</svg>']];
  const found = logoFindings(originals, [
    ['apps/web/public/mark.svg', '<svg>a</svg>'],
    ['apps/admin/public/mark.svg', '<svg>b</svg>'],
    ['apps/web/public/other.svg', '<svg>c</svg>'],
  ]);
  assert.deepEqual(rules(found), ['warning:logo-copy', 'error:logo-copy']);
});

test('manifest: missing files, unknown owners and a light theme that ignores SITE_SCHEME', () => {
  const surface = {
    id: 's',
    name: 'S',
    scheme: 'site',
    owner: 'nobody',
    status: 'live',
    theme: ['a.css'],
    fonts: ['gone.ts'],
    logo: [],
    copy: [],
  };
  const found = manifestFindings([surface], {
    exists: (p) => p === 'a.css',
    agents: new Set(['web-engineer']),
    read: () => 'body { color: red; }',
  });
  assert.deepEqual(
    found.map((f) => f.message),
    [
      'owner nobody is not an agent in .claude/agents/',
      'fonts: gone.ts does not exist',
      'site surface s: no theme file uses SITE_SCHEME, cssVariables() or the brand variables',
    ]
  );
});

test('known drift downgrades its finding, and a stale entry is an error', () => {
  const findings = [{ rule: 'brand-rgb', level: 'error', file: 'f.tsx', message: 'rgb(1,2,3) is #010203' }];
  const known = [
    { rule: 'brand-rgb', file: 'f.tsx', match: 'rgb(1,2,3)', reason: 'r', todo: true },
    { rule: 'brand-hex', file: 'g.tsx', match: '#000000', reason: 'fixed already' },
  ];
  const out = applyKnown(findings, known);
  assert.deepEqual(rules(out), ['known:brand-rgb', 'error:known-drift']);
  assert.equal(out[0].todo, true);
});

test('brand token helpers read hexes and families from the module', () => {
  const brand = {
    DARK: { bg: '#0b0d12' },
    RAMP: ['#7B2FF7'],
    FONT_FAMILY: { display: 'X' },
    BODY_FONT_FAMILY: 'Y',
    fn: () => '#FFFFFF',
  };
  assert.deepEqual([...brandHexes(brand)].sort(), ['#0B0D12', '#7B2FF7']);
  assert.deepEqual([...brandFamilies(brand)].sort(), ['X', 'Y']);
});

test('every surface has a unique id, a known scheme and status', () => {
  const ids = SURFACES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SURFACES) {
    assert.ok(['dark', 'site'].includes(s.scheme), s.id);
    assert.ok(['live', 'dev', 'paused'].includes(s.status), s.id);
  }
});

test('the repository passes the brand audit', async () => {
  const errors = (await audit()).filter((f) => f.level === 'error');
  assert.deepEqual(errors, []);
});
