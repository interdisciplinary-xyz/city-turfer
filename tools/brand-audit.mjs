#!/usr/bin/env node
/**
 * `pnpm run audit:brand`: does every surface (tools/brand/surfaces.mjs) still draw its brand from
 * `packages/brand`? The rules are the mechanical part of the `brand-system` checklist; how a surface
 * should look is the `brand-surfaces` skill.
 *
 * Errors (exit 1):
 *   manifest      a surface names a file that does not exist, an owner agent that does not exist, or
 *                 a site surface whose theme files never mention SITE_SCHEME / cssVariables
 *   brand-hex     a brand colour written as hex outside packages/brand (allowlist: ALLOWED_HEX)
 *   brand-rgb     a brand colour written as rgb()/rgba() channels outside packages/brand
 *   named-scheme  a scheme picked by name (cssVariables('light'), THEMES.dark…) outside packages/brand,
 *                 where SITE_SCHEME (site surfaces) or usePalette() (the app) must decide
 *   font-face     an @font-face or font file reference that is not a brand family or not a file in
 *                 packages/brand/fonts
 *   name          the product name spelt any way other than "CityTurfer" in user-facing copy
 *   territory     "territory" in English user-facing copy (Polish "terytorium" is right)
 *   logo-copy     a mark / wordmark SVG outside packages/brand/svg that differs from the original
 *
 * Warnings (reported, exit 0): other hex literals, surfaces without a theme or fonts (the plan's
 * to-do list), identical logo copies (fine, but a generated copy is better).
 *
 *   pnpm run audit:brand              report, exit 1 on errors
 *   pnpm run audit:brand -- --json    machine-readable findings
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { KNOWN_DRIFT } from './brand/known-drift.mjs';
import { SURFACES } from './brand/surfaces.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Source folders scanned for literals. packages/brand is the source of truth and is never scanned. */
export const SCAN_DIRS = [
  'apps/web/src',
  'apps/web/tools',
  'apps/api/src',
  'apps/mobile/src',
  'apps/mobile/app.json',
  'apps/storybook/.storybook',
  'apps/storybook/src',
  'apps/admin/src',
  'packages/ui/src',
];

const SCAN_EXT = new Set(['.ts', '.tsx', '.mjs', '.js', '.css', '.scss', '.html', '.json']);
const SKIP_DIR = new Set(['node_modules', '__tests__', '.next', 'out', 'storybook-static', 'dist', 'migrations']);
const SKIP_FILE = /\.(test|spec|stories)\.[cm]?[jt]sx?$|payload-types\.ts$|importMap\.js$/;

/** Hex that may stay literal, with the reason (files that cannot import TypeScript). */
export const ALLOWED_HEX = {
  'apps/mobile/app.json': 'native config: Expo reads JSON, no imports (splash and adaptive icon background)',
};

/** User-facing copy: catalogues and the words other surfaces show. */
export const COPY_FILES = [
  'apps/web/messages',
  'apps/mobile/messages',
  'apps/api/src/guide.ts',
  'apps/api/src/spec.ts',
  'apps/web/tools/swagger-route.mjs',
  'apps/storybook/.storybook/manager-head.html',
  'packages/brand/src/copy.ts',
  'packages/brand/templates',
  'apps/mobile/app.json',
];

/** English catalogues, where "territory" is banned (brand-system: internal term only). */
export const ENGLISH_COPY = ['apps/web/messages/en.json', 'apps/mobile/messages/en'];

/** Wrong spellings of the name. Lower-case `cityturfer` is a domain or package name, not copy. */
const BAD_NAME = /\b(City[ -][Tt]urfer|Cityturfer|CityTurFer|Cityturfers)\b/g;

/** Where logo copies could hide. */
const LOGO_DIRS = [
  'apps/web/public',
  'apps/web/src',
  'apps/storybook',
  'apps/admin/public',
  'apps/admin/src',
  'apps/mobile/assets',
];

// ---------------------------------------------------------------------------------------------

const rel = (p) => relative(ROOT, p).split('\\').join('/');

/** Files under `p` (a file or folder) with a scanned extension. */
export function walk(p, ext = SCAN_EXT) {
  if (!existsSync(p)) {
    return [];
  }
  const s = statSync(p);
  if (!s.isDirectory()) {
    return ext.has(extname(p)) ? [p] : [];
  }
  const out = [];
  for (const e of readdirSync(p)) {
    if (SKIP_DIR.has(e) || (e.startsWith('.') && e !== '.storybook')) {
      continue;
    }
    out.push(...walk(join(p, e), ext));
  }
  return out.filter((f) => !SKIP_FILE.test(f));
}

/** Every hex string value in a module object (tokens, palettes, ramps), upper-cased. */
export function brandHexes(brand) {
  const found = new Set();
  const visit = (v, depth) => {
    if (depth > 4 || v === null) {
      return;
    }
    if (typeof v === 'string') {
      for (const m of v.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
        found.add(m.toUpperCase());
      }
    } else if (typeof v === 'object') {
      Object.values(v).forEach((x) => visit(x, depth + 1));
    }
  };
  Object.entries(brand)
    .filter(([, v]) => typeof v !== 'function')
    .forEach(([, v]) => visit(v, 0));
  return found;
}

/** Brand font family names (the PostScript names the app uses, plus the web body face). */
export function brandFamilies(brand) {
  return new Set(
    [...Object.values(brand.FONT_FAMILY ?? {}), brand.BODY_FONT_FAMILY, brand.TAGLINE_FONT_FAMILY].filter(Boolean)
  );
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');

/** Line number (1-based) of an index in a text. */
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Literal findings in one file's text. Pure, so the tests can feed it strings.
 *
 * @param {string} file repo-relative path
 * @param {string} text file contents
 * @param {{ hexes: Set<string>, families: Set<string>, fontFiles: Set<string> }} brand
 */
export function literalFindings(file, text, brand) {
  const findings = [];
  const add = (rule, level, index, message) => findings.push({ rule, level, file, line: lineOf(text, index), message });

  if (!ALLOWED_HEX[file]) {
    for (const m of text.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = m[0].toUpperCase();
      // Skip anchors and ids such as href="#a1b2c3" and colour-free hashes in URLs.
      const before = text.slice(Math.max(0, m.index - 6), m.index);
      if (/(href=["']|url\(|\/)$/.test(before)) {
        continue;
      }
      if (brand.hexes.has(hex)) {
        add('brand-hex', 'error', m.index, `${m[0]} is a brand colour: take it from @cityturfer/brand`);
      } else {
        add('hex', 'warning', m.index, `${m[0]} is not a brand token: add a token or explain it`);
      }
    }
  }

  const rgbBrand = new Map([...brand.hexes].map((h) => [hexToRgb(h), h]));
  for (const m of text.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
    const key = `${Number(m[1])},${Number(m[2])},${Number(m[3])}`;
    if (rgbBrand.has(key)) {
      add(
        'brand-rgb',
        'error',
        m.index,
        `rgb(${key}) is ${rgbBrand.get(key)}: use a token (color-mix() over a variable on the web)`
      );
    }
  }

  for (const m of text.matchAll(
    /\bcssVariables\(\s*['"](light|dark)['"]|\bTHEMES(?:\.(light|dark)\b|\[\s*['"](light|dark)['"]\s*\])/g
  )) {
    add(
      'named-scheme',
      'error',
      m.index,
      `${m[0]}: pick the scheme through SITE_SCHEME (site surfaces) or usePalette() (the app)`
    );
  }

  for (const m of text.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const block = m[1];
    const family = block.match(/font-family:\s*['"]?([^'";]+)['"]?/)?.[1]?.trim();
    if (family && !brand.families.has(family)) {
      add(
        'font-face',
        'error',
        m.index,
        `@font-face "${family}" is not a brand family (FONT_FAMILY, BODY_FONT_FAMILY, TAGLINE_FONT_FAMILY)`
      );
    }
    for (const u of block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (!brand.fontFiles.has(basename(u[1]))) {
        add('font-face', 'error', m.index, `@font-face source ${u[1]} is not a file in packages/brand/fonts`);
      }
    }
  }
  for (const m of text.matchAll(/packages\/brand\/fonts\/([\w.-]+\.(?:woff2|ttf|otf))/g)) {
    if (!brand.fontFiles.has(m[1])) {
      add('font-face', 'error', m.index, `packages/brand/fonts/${m[1]} does not exist`);
    }
  }
  return findings;
}

/** Leaf strings of a JSON catalogue with their key paths. */
function leaves(value, prefix = '') {
  if (typeof value === 'string') {
    return [[prefix, value]];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

/**
 * Copy findings in one file. JSON catalogues are checked value by value (keys may say territory),
 * other files as text.
 */
export function copyFindings(file, text, { english = false } = {}) {
  const findings = [];
  const entries = file.endsWith('.json') ? leaves(JSON.parse(text)) : [['', text]];
  for (const [key, value] of entries) {
    const where = (index) => (key ? { key } : { line: lineOf(value, index) });
    for (const m of value.matchAll(BAD_NAME)) {
      findings.push({
        rule: 'name',
        level: 'error',
        file,
        ...where(m.index),
        message: `"${m[0]}": the name is CityTurfer`,
      });
    }
    if (english && key) {
      for (const m of value.matchAll(/\bterritor(y|ies)\b/gi)) {
        findings.push({ rule: 'territory', level: 'error', file, key, message: `"${m[0]}" in English copy: say turf` });
      }
    }
  }
  return findings;
}

/** Manifest findings: missing files, unknown owners, site surfaces whose theme ignores SITE_SCHEME. */
export function manifestFindings(surfaces, { exists, agents, read }) {
  const findings = [];
  const ids = new Set();
  for (const s of surfaces) {
    const file = `tools/brand/surfaces.mjs#${s.id}`;
    if (ids.has(s.id)) {
      findings.push({ rule: 'manifest', level: 'error', file, message: `duplicate surface id ${s.id}` });
    }
    ids.add(s.id);
    if (!agents.has(s.owner)) {
      findings.push({
        rule: 'manifest',
        level: 'error',
        file,
        message: `owner ${s.owner} is not an agent in .claude/agents/`,
      });
    }
    for (const field of ['theme', 'fonts', 'logo', 'copy']) {
      for (const p of s[field]) {
        if (!exists(p)) {
          findings.push({ rule: 'manifest', level: 'error', file, message: `${field}: ${p} does not exist` });
        }
      }
    }
    if (s.status !== 'paused') {
      if (s.theme.length === 0) {
        findings.push({ rule: 'unthemed', level: 'warning', file, message: `${s.name} has no brand theme` });
      }
      if (s.fonts.length === 0) {
        findings.push({ rule: 'unthemed', level: 'warning', file, message: `${s.name} loads no brand fonts` });
      }
    }
    if (s.scheme === 'site' && s.theme.length > 0) {
      const texts = s.theme.filter(exists).map(read);
      if (!texts.some((t) => /SITE_SCHEME|cssVariables|var\(--(bg|card|text)\)/.test(t))) {
        findings.push({
          rule: 'manifest',
          level: 'error',
          file,
          message: `site surface ${s.id}: no theme file uses SITE_SCHEME, cssVariables() or the brand variables`,
        });
      }
    }
  }
  return findings;
}

/** Logo SVG copies outside packages/brand/svg: identical = warning, different = error. */
export function logoFindings(originals, candidates) {
  const hash = (t) => createHash('sha256').update(t).digest('hex');
  const byName = new Map(originals.map(([name, text]) => [name, hash(text)]));
  return candidates.flatMap(([file, text]) => {
    const name = basename(file);
    if (!byName.has(name)) {
      return [];
    }
    return byName.get(name) === hash(text)
      ? [
          {
            rule: 'logo-copy',
            level: 'warning',
            file,
            message: `copy of packages/brand/svg/${name}: serve the original instead`,
          },
        ]
      : [
          {
            rule: 'logo-copy',
            level: 'error',
            file,
            message: `differs from packages/brand/svg/${name}: a drifted logo`,
          },
        ];
  });
}

// ---------------------------------------------------------------------------------------------

async function loadBrandModule() {
  // @cityturfer/brand is TypeScript; the Swagger tooling already bundles it for Node.
  const { loadBrand } = await import(pathToFileURL(join(ROOT, 'apps/web/tools/swagger-brand.mjs')).href);
  return loadBrand(join(ROOT, 'apps/web'));
}

export async function audit() {
  const brand = await loadBrandModule();
  const ctx = {
    hexes: brandHexes(brand),
    families: brandFamilies(brand),
    fontFiles: new Set(readdirSync(join(ROOT, 'packages/brand/fonts'))),
  };
  const findings = [];

  const agents = new Set(readdirSync(join(ROOT, '.claude/agents')).map((f) => f.replace(/\.md$/, '')));
  findings.push(
    ...manifestFindings(SURFACES, {
      exists: (p) => existsSync(join(ROOT, p)),
      agents,
      read: (p) => (statSync(join(ROOT, p)).isDirectory() ? '' : readFileSync(join(ROOT, p), 'utf8')),
    })
  );

  for (const f of SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
    findings.push(...literalFindings(rel(f), readFileSync(f, 'utf8'), ctx));
  }

  const english = ENGLISH_COPY.flatMap((p) => walk(join(ROOT, p))).map(rel);
  for (const f of COPY_FILES.flatMap((p) => walk(join(ROOT, p)))) {
    findings.push(...copyFindings(rel(f), readFileSync(f, 'utf8'), { english: english.includes(rel(f)) }));
  }

  const svg = new Set(['.svg']);
  const originals = walk(join(ROOT, 'packages/brand/svg'), svg).map((f) => [basename(f), readFileSync(f, 'utf8')]);
  const candidates = LOGO_DIRS.flatMap((d) => walk(join(ROOT, d), svg)).map((f) => [rel(f), readFileSync(f, 'utf8')]);
  findings.push(...logoFindings(originals, candidates));

  return applyKnown(findings, KNOWN_DRIFT);
}

/**
 * Known drift (tools/brand/known-drift.mjs) turns matching errors into level "known"; an entry that
 * matches nothing becomes an error, so a fixed drift must also leave the list.
 */
export function applyKnown(findings, known) {
  const used = new Set();
  const out = findings.map((f) => {
    const i = known.findIndex((k) => k.rule === f.rule && k.file === f.file && f.message.includes(k.match));
    if (i === -1 || f.level !== 'error') {
      return f;
    }
    used.add(i);
    return { ...f, level: 'known', message: `${f.message} (known: ${known[i].reason})`, todo: Boolean(known[i].todo) };
  });
  known.forEach((k, i) => {
    if (!used.has(i)) {
      out.push({
        rule: 'known-drift',
        level: 'error',
        file: 'tools/brand/known-drift.mjs',
        message: `${k.rule} in ${k.file} ("${k.match}") no longer occurs: delete the entry`,
      });
    }
  });
  return out;
}

const LABEL = { error: 'error', warning: 'warn ', known: 'known' };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = await audit();
  const count = (level) => findings.filter((f) => f.level === level).length;
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ surfaces: SURFACES.map((s) => s.id), findings }, null, 2));
  } else {
    for (const f of findings) {
      const at = f.line ? `:${f.line}` : f.key ? ` ${f.key}` : '';
      console.log(`${LABEL[f.level]} ${f.rule.padEnd(12)} ${f.file}${at}: ${f.message}`);
    }
    console.log(
      `audit:brand: ${SURFACES.length} surfaces, ${count('error')} error(s), ${count('warning')} warning(s), ${count('known')} known`
    );
  }
  process.exit(count('error') > 0 ? 1 : 0);
}
