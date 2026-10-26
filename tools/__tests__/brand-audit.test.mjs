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
  stripComments,
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

test('8-digit hex and space-syntax rgb() count too', () => {
  const css = 'a { color: #F72FA8CC; }\nb { color: rgb(123 47 247 / 55%); }\nc { color: rgba(123,47,247,.4); }';
  const found = literalFindings('apps/web/src/x.css', css, CTX);
  assert.deepEqual(rules(found), ['error:brand-hex', 'error:brand-rgb', 'error:brand-rgb']);
  assert.match(found[0].message, /#F72FA8CC \(#F72FA8 with alpha\)/);
  // false positives: another colour with alpha, 7 digits (not a colour), channels of a non-brand colour
  assert.deepEqual(rules(literalFindings('apps/web/src/x.css', '#123456CC #F72FA8C rgb(1 2 3)', CTX)), ['warning:hex']);
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

test('site code may not import the DARK / LIGHT palettes; the app and the brand book may', () => {
  const imp = "import { cssVariables, DARK, type Palette, LIGHT as L } from '@cityturfer/brand';";
  const named = (file) => literalFindings(file, imp, CTX).filter((f) => f.rule === 'named-scheme');
  assert.deepEqual(
    named('apps/web/src/app/x.tsx').map((f) => f.message.split(' ')[0]),
    ['DARK', 'LIGHT']
  );
  assert.equal(named('apps/storybook/.storybook/x.ts').length, 2);
  // false positives: the app is always dark, the brand book shows both, other packages' DARK
  assert.deepEqual(named('apps/mobile/src/app/sign-in.tsx'), []);
  assert.deepEqual(named('apps/web/src/app/branding/page.dev.tsx'), []);
  assert.deepEqual(
    literalFindings('apps/web/src/x.ts', "import { DARK } from './map-styles';\nconst THEME_DARK = 1;", CTX),
    []
  );
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

test('the old name TurfTrack is copy drift; slugs, bundle ids and the repo folder are not', () => {
  const text = 'TurfTrack records walks. Turf Track too. TURF TRACK!';
  assert.deepEqual(
    copyFindings('apps/api/src/guide.ts', text).map((f) => f.message.split(':')[0]),
    ['"TurfTrack"', '"Turf Track"', '"TURF TRACK"']
  );
  const ids = JSON.stringify({
    expo: { slug: 'turftrack', scheme: 'turftrack', ios: { bundleIdentifier: 'com.turftrack.poc' } },
  });
  assert.deepEqual(copyFindings('apps/mobile/app.json', ids), []);
  assert.deepEqual(copyFindings('apps/api/src/guide.ts', 'See ~/Code/turf-track and turftrack://'), []);
});

test('English catalogues never say score, points or conquer', () => {
  const en = JSON.stringify({ a: 'Your score', b: 'Earn points', c: 'Conquer the city', d: 'Scored!', score: 'Glow' });
  assert.deepEqual(
    copyFindings('apps/mobile/messages/en/x.json', en, { english: true }).map((f) => `${f.rule} ${f.key}`),
    ['vocabulary a', 'vocabulary b', 'vocabulary c', 'vocabulary d']
  );
  // false positives: keys, other languages, non-catalogue text (the API guide's track points)
  assert.deepEqual(copyFindings('apps/mobile/messages/pl/x.json', JSON.stringify({ a: 'punkty' })), []);
  assert.deepEqual(copyFindings('apps/api/src/guide.ts', '≤ 40,000 points per track'), []);
  assert.deepEqual(
    copyFindings('apps/mobile/messages/en/x.json', JSON.stringify({ a: 'Starting point' }), { english: true }),
    []
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

test('manifest: missing files, unknown owners and a theme file that ignores SITE_SCHEME', () => {
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
      'theme file a.css of s draws nothing from the brand in its code (SITE_SCHEME, cssVariables(), THEMES, a brand variable, or another theme file of the surface); comments do not count',
    ]
  );
});

test('manifest: every theme file needs brand code of its own or an import of one; comments do not count', () => {
  const files = {
    'a/theme.ts': "import { THEMES, SITE_SCHEME } from '@cityturfer/brand';\nexport const t = THEMES[SITE_SCHEME];",
    'a/preview.tsx': "import { t } from './theme';\n// SITE_SCHEME",
    'a/skin.css': '/* uses SITE_SCHEME and var(--bg) */\nbody { color: red; }',
    'a/page.css': 'body { background: var(--bg); color: var(--text, #fff); }',
    'a/near.css': 'body { background: var(--bg-image); }',
    'a/only-comment.tsx': '// cssVariables(SITE_SCHEME)\nexport const x = 1;',
  };
  const surface = (theme, scheme = 'site') => ({
    id: 's',
    name: 'S',
    scheme,
    owner: 'web-engineer',
    status: 'live',
    theme,
    fonts: [],
    logo: [],
    copy: [],
  });
  const bad = (theme, scheme) =>
    manifestFindings([surface(theme, scheme)], {
      exists: (p) => p in files,
      agents: new Set(['web-engineer']),
      read: (p) => files[p],
      brandVars: new Set(['--bg', '--text']),
    })
      .filter((f) => f.rule === 'manifest')
      .map((f) => f.message.split(' ')[2]);
  assert.deepEqual(bad(['a/theme.ts', 'a/preview.tsx', 'a/page.css']), []);
  assert.deepEqual(bad(['a/skin.css', 'a/near.css', 'a/only-comment.tsx']), [
    'a/skin.css',
    'a/near.css',
    'a/only-comment.tsx',
  ]);
  assert.deepEqual(bad(['a/preview.tsx']), ['a/preview.tsx']); // its import is not a theme file here
  assert.deepEqual(bad(['a/skin.css'], 'both'), ['a/skin.css']);
  assert.deepEqual(bad(['a/skin.css'], 'dark'), []); // the app's theme is checked by other rules
  assert.equal(stripComments('a // b\nc /* d */ e <!-- f -->'), 'a \nc  e ');
  assert.equal(stripComments("url('https://x.y/z')"), "url('https://x.y/z')");
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

test('known drift covers only its count: one more occurrence is an error, fewer means lower it', () => {
  const f = { rule: 'brand-rgb', level: 'error', file: 'f.tsx', message: 'rgb(1,2,3) is #010203' };
  const entry = { rule: 'brand-rgb', file: 'f.tsx', match: 'rgb(1,2,3)', reason: 'r' };
  assert.deepEqual(rules(applyKnown([f, f], [entry])), ['known:brand-rgb', 'error:brand-rgb']);
  assert.match(applyKnown([f, f], [entry])[1].message, /allows 1; this one is new/);
  assert.deepEqual(rules(applyKnown([f, f], [{ ...entry, count: 2 }])), ['known:brand-rgb', 'known:brand-rgb']);
  assert.deepEqual(rules(applyKnown([f], [{ ...entry, count: 2 }])), ['known:brand-rgb', 'error:known-drift']);
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
    assert.ok(['dark', 'site', 'both'].includes(s.scheme), s.id);
    assert.ok(['live', 'dev', 'paused'].includes(s.status), s.id);
  }
});

test('the repository passes the brand audit', async () => {
  const errors = (await audit()).filter((f) => f.level === 'error');
  assert.deepEqual(errors, []);
});
