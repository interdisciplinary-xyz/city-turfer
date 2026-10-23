// WCAG AA for the Swagger skin's coloured labels: every HTTP method badge (label on its fill) and
// every table-of-contents method label (on the page, the card, and the hover and current
// highlights). The pairs are read from apps/web/tools/swagger-theme.css and resolved against
// cssVariables(SITE_SCHEME), so a token or skin change that drops a pair below 4.5:1 fails here.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { before, test } from 'node:test';

import { loadBrand } from '../../apps/web/tools/swagger-brand.mjs';

const WEB = path.resolve(import.meta.dirname, '../../apps/web');
const SKIN = path.join(WEB, 'tools/swagger-theme.css');

let brand;
let vars;
let rules;

/** selector → declarations, for every plain rule (also those inside @media). Last one wins. */
function parseRules(css) {
  const out = new Map();
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selectors, body] of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = Object.fromEntries(
      body
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()])
    );
    for (const selector of selectors.split(',').map((s) => s.replace(/\s+/g, ' ').trim())) {
      out.set(selector, { ...out.get(selector), ...decls });
    }
  }
  return out;
}

function declaration(selector, property) {
  const value = rules.get(selector)?.[property];
  assert.ok(value, `${selector} { ${property} } is missing from swagger-theme.css`);
  return value;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** A CSS colour value → #RRGGBB: brand variables, the skin's own --ct-* variables, color-mix in srgb. */
function resolve(value) {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    return v.toUpperCase();
  }
  const variable = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(v);
  if (variable) {
    const [, name, fallback] = variable;
    const own = rules.get(':root')?.[name];
    const found = vars[name] ?? own ?? fallback;
    assert.ok(found, `${name} is not defined`);
    return resolve(found);
  }
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$/.exec(v);
  if (mix) {
    const [, a, pct, b] = mix;
    const p = Number(pct) / 100;
    const [ca, cb] = [hex(resolve(a)), hex(resolve(b))];
    return toHex(ca.map((c, i) => c * p + cb[i] * (1 - p)));
  }
  throw new Error(`Cannot resolve colour ${value}`);
}

before(async () => {
  brand = await loadBrand(WEB);
  vars = brand.cssVariables(brand.SITE_SCHEME);
  rules = parseRules(await readFile(SKIN, 'utf8'));
});

const AA = () => brand.MIN_CONTRAST.text;

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/** The opblock rule that sets a method's --ct-method and --ct-method-label. */
function methodRule(method) {
  const selector = [...rules.keys()].find(
    (s) => s === `.swagger-ui .opblock.opblock-${method}` && rules.get(s)['--ct-method']
  );
  assert.ok(selector, `no fill for ${method.toUpperCase()}`);
  return rules.get(selector);
}

test('every method badge label reaches 4.5:1 on its fill', () => {
  // The badge draws the label colour from --ct-method-label (no per-method exceptions).
  const badge = '.swagger-ui .opblock .opblock-summary-method';
  assert.match(declaration(badge, 'color'), /var\(--ct-method-label/);
  for (const method of METHODS) {
    const rule = methodRule(method);
    assert.ok(rule['--ct-method-label'], `${method.toUpperCase()} has no badge label colour`);
    const fill = resolve(rule['--ct-method']);
    const label = resolve(rule['--ct-method-label']);
    const ratio = brand.contrastRatio(label, fill);
    assert.ok(ratio >= AA(), `${method.toUpperCase()} badge ${label} on ${fill} is ${ratio.toFixed(2)}:1`);
  }
});

test('every table-of-contents method label reaches 4.5:1 on the page, the card and the highlights', () => {
  const backgrounds = {
    page: vars['--bg'],
    card: vars['--card'],
  };
  const hover = resolve(declaration('.ct-toc-link:hover', 'background'));
  const current = resolve(declaration(".ct-toc-link[aria-current='true']", 'background'));
  const base = declaration('.ct-toc-method', 'color');
  for (const method of METHODS) {
    const own = rules.get(`.ct-toc-method-${method}`)?.color;
    const label = resolve(own ?? base);
    for (const [where, bg] of Object.entries(backgrounds)) {
      const ratio = brand.contrastRatio(label, resolve(bg));
      assert.ok(ratio >= AA(), `TOC ${method.toUpperCase()} ${label} on ${where} is ${ratio.toFixed(2)}:1`);
    }
  }
  // On hover and on the current entry every method label turns to one colour.
  for (const [state, bg, selector] of [
    ['hover', hover, '.ct-toc-link:hover .ct-toc-method'],
    ['current', current, ".ct-toc-link[aria-current='true'] .ct-toc-method"],
  ]) {
    const label = resolve(declaration(selector, 'color'));
    const ratio = brand.contrastRatio(label, bg);
    assert.ok(ratio >= AA(), `TOC label on ${state} ${bg} is ${ratio.toFixed(2)}:1`);
  }
});

test('the hover and current highlights stand apart from the page, the card and each other', () => {
  const hover = resolve(declaration('.ct-toc-link:hover', 'background'));
  const current = resolve(declaration(".ct-toc-link[aria-current='true']", 'background'));
  for (const [state, bg] of [
    ['hover', hover],
    ['current', current],
  ]) {
    assert.notEqual(bg, resolve('var(--bg)'), `${state} is the page colour`);
    assert.notEqual(bg, resolve('var(--card)'), `${state} is the card colour`);
  }
  assert.notEqual(hover, current, 'hover and current look the same');
  // The current entry also carries a glow bar, a graphic: at least 3:1 on the page and the card.
  assert.match(declaration(".ct-toc-link[aria-current='true']", 'box-shadow'), /var\(--glow\)/);
  for (const bg of ['--bg', '--card']) {
    assert.ok(brand.contrastRatio(vars['--glow'], vars[bg]) >= brand.MIN_CONTRAST.ui, `glow bar on ${bg}`);
  }
});

test('links and the version stamp use the accent text colour, AA on the page and the card', () => {
  for (const selector of ['a', '.swagger-ui .renderedMarkdown a', '.swagger-ui .info .title small.version-stamp pre']) {
    assert.equal(declaration(selector, 'color'), 'var(--accent-text)', selector);
  }
  for (const bg of ['--bg', '--card']) {
    assert.ok(brand.contrastRatio(vars['--accent-text'], vars[bg]) >= AA(), `--accent-text on ${bg}`);
  }
});

test('the Execute and Authorize labels reach 4.5:1 on the glow fill', () => {
  const button = '.swagger-ui .btn.execute';
  const fill = resolve(declaration(button, 'background'));
  const label = resolve(declaration(button, 'color'));
  assert.equal(declaration(button, 'color'), 'var(--on-accent)');
  assert.equal(declaration('.swagger-ui .btn.authorize span', 'color'), 'var(--on-accent)');
  assert.ok(brand.contrastRatio(label, fill) >= AA(), `${label} on ${fill}`);
  const hover = resolve(declaration('.swagger-ui .btn.execute:hover', 'background'));
  assert.ok(brand.contrastRatio(label, hover) >= AA(), `${label} on hover ${hover}`);
});
