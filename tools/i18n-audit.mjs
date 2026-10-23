#!/usr/bin/env node
/**
 * `pnpm run audit:i18n`: the message catalogues agree across locales and every message is valid
 * ICU (docs/decisions/mobile-i18n-2026-10-23.md, L11).
 *
 * Catalogues:
 *   - the app:     apps/mobile/messages/<locale>/<namespace>.json (one file per namespace);
 *   - the website: apps/web/messages/<locale>.json (one file per locale, nested namespaces).
 * Locales are the folders (app) or files (website) found; `en` is the source every other locale is
 * compared with. A missing app catalogue is reported as a note and passes (it is created in step 1).
 *
 * Fails on, per file and key path:
 *   1. a namespace file or leaf key the source has and a locale lacks, or the other way round;
 *   2. a value that is not a string or an object of strings/objects, an empty string, a key with a
 *      `.` (use-intl reads dots as nesting) or an empty object;
 *   3. a message the ICU parser rejects (parsed as use-intl does: tags on, `other` required);
 *   4. placeholders (arguments and rich-text tags) or select options that differ from the source;
 *   5. a plural without every category the locale's CLDR rules have (`Intl.PluralRules`: en = one,
 *      other; pl = one, few, many, other); `selectordinal` likewise with ordinal rules. Exact
 *      matches (`=0`) never stand in for a category.
 *
 * Output: one line per finding, `<file> <key>: <message>`; exit 1 on any finding.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, TYPE } from '@formatjs/icu-messageformat-parser';

export const SOURCE_LOCALE = 'en';
export const APP_MESSAGES = 'apps/mobile/messages';
export const WEB_MESSAGES = 'apps/web/messages';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Leaf messages of a JSON value, keyed by dotted path, plus structural findings.
 *
 * @returns {{ leaves: Map<string, string>, findings: { key: string, message: string }[] }}
 */
export function flatten(value, prefix = '') {
  const leaves = new Map();
  const findings = [];
  const walk = (node, path) => {
    const entries = Object.entries(node);
    if (entries.length === 0) {
      findings.push({ key: path || '(root)', message: 'empty object' });
    }
    for (const [k, v] of entries) {
      const key = path ? `${path}.${k}` : k;
      if (k.includes('.')) {
        findings.push({ key, message: 'key contains "." (use-intl reads it as nesting)' });
      }
      if (typeof v === 'string') {
        if (v.trim() === '') {
          findings.push({ key, message: 'empty string' });
        }
        leaves.set(key, v);
      } else if (isPlainObject(v)) {
        walk(v, key);
      } else {
        findings.push({ key, message: `value is ${Array.isArray(v) ? 'an array' : typeof v}, not a string or object` });
      }
    }
  };
  if (isPlainObject(value)) {
    walk(value, prefix);
  } else {
    findings.push({ key: prefix || '(root)', message: 'file is not a JSON object' });
  }
  return { leaves, findings };
}

/**
 * What a message exposes to its caller and translators: argument names, tag names, and the option
 * keys of each select, found anywhere in the (nested) AST.
 */
function shapeOf(ast) {
  const placeholders = new Set();
  const selects = new Map(); // argument → sorted option keys
  const plurals = []; // { value, ordinal, options }
  const visit = (nodes) => {
    for (const n of nodes) {
      switch (n.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          placeholders.add(n.value);
          break;
        case TYPE.tag:
          placeholders.add(`<${n.value}>`);
          visit(n.children);
          break;
        case TYPE.select:
          placeholders.add(n.value);
          selects.set(n.value, Object.keys(n.options).sort().join(', '));
          for (const o of Object.values(n.options)) {
            visit(o.value);
          }
          break;
        case TYPE.plural:
          placeholders.add(n.value);
          plurals.push({ value: n.value, ordinal: n.pluralType === 'ordinal', options: Object.keys(n.options) });
          for (const o of Object.values(n.options)) {
            visit(o.value);
          }
          break;
        default:
          break;
      }
    }
  };
  visit(ast);
  return { placeholders, selects, plurals };
}

const categoriesCache = new Map();
/** CLDR plural categories of a locale (`ordinal` for selectordinal). */
export function pluralCategories(locale, ordinal = false) {
  const id = `${locale}:${ordinal}`;
  if (!categoriesCache.has(id)) {
    const rules = new Intl.PluralRules(locale, { type: ordinal ? 'ordinal' : 'cardinal' });
    const order = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const categories = rules.resolvedOptions().pluralCategories;
    categoriesCache.set(
      id,
      [...categories].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    );
  }
  return categoriesCache.get(id);
}

/**
 * Parse one message for `locale`.
 *
 * @returns {{ shape: ReturnType<typeof shapeOf> | null, findings: string[] }}
 */
export function checkMessage(message, locale) {
  let ast;
  try {
    ast = parse(message, { requiresOtherClause: true });
  } catch (error) {
    return { shape: null, findings: [`not valid ICU: ${error.message}`] };
  }
  const shape = shapeOf(ast);
  const findings = [];
  for (const p of shape.plurals) {
    const missing = pluralCategories(locale, p.ordinal).filter((c) => !p.options.includes(c));
    if (missing.length) {
      const kind = p.ordinal ? 'selectordinal' : 'plural';
      findings.push(
        `${kind} {${p.value}} lacks ${missing.join(', ')} (${locale} needs ${pluralCategories(locale, p.ordinal).join(', ')})`
      );
    }
  }
  return { shape, findings };
}

const sorted = (set) => [...set].sort().join(', ') || '(none)';

/**
 * Compare one locale's leaves with the source's. `file` names where findings go.
 *
 * @param {{ locale: string, file: string, leaves: Map<string, string> }} target
 * @param {{ locale: string, file: string, leaves: Map<string, string> } | null} source
 */
function compareLeaves(target, source, shapes) {
  const out = [];
  if (source) {
    for (const key of source.leaves.keys()) {
      if (!target.leaves.has(key)) {
        out.push({ file: target.file, key, message: `missing (${source.locale} has it)` });
      }
    }
    for (const key of target.leaves.keys()) {
      if (!source.leaves.has(key)) {
        out.push({ file: target.file, key, message: `extra (not in ${source.locale})` });
      }
    }
  }
  for (const [key, message] of target.leaves) {
    const { shape, findings } = checkMessage(message, target.locale);
    out.push(...findings.map((m) => ({ file: target.file, key, message: m })));
    if (!shape) {
      continue;
    }
    if (!source) {
      shapes.set(key, shape);
      continue;
    }
    const base = shapes.get(key);
    if (!base) {
      continue;
    }
    if (sorted(base.placeholders) !== sorted(shape.placeholders)) {
      out.push({
        file: target.file,
        key,
        message: `placeholders ${sorted(shape.placeholders)} differ from ${source.locale}: ${sorted(base.placeholders)}`,
      });
    }
    for (const [arg, options] of base.selects) {
      const own = shape.selects.get(arg);
      if (own !== undefined && own !== options) {
        out.push({
          file: target.file,
          key,
          message: `select {${arg}} options ${own} differ from ${source.locale}: ${options}`,
        });
      }
    }
  }
  return out;
}

function readJson(root, file) {
  try {
    return { value: JSON.parse(readFileSync(join(root, file), 'utf8')) };
  } catch (error) {
    return { error: `not valid JSON: ${error.message}` };
  }
}

/** Order the locales so the source comes first. */
const sourceFirst = (locales) =>
  [...locales].sort((a, b) => (a === SOURCE_LOCALE ? -1 : b === SOURCE_LOCALE ? 1 : a.localeCompare(b)));

/**
 * Audit a set of `{ locale, file, value }` documents that should hold the same keys.
 * The source locale's document is the reference; without one, each is only checked on its own.
 */
function auditDocuments(docs) {
  const findings = [];
  const shapes = new Map();
  const flat = docs.map((d) => {
    const { leaves, findings: structural } = flatten(d.value);
    findings.push(...structural.map((f) => ({ file: d.file, ...f })));
    return { locale: d.locale, file: d.file, leaves };
  });
  const source = flat.find((d) => d.locale === SOURCE_LOCALE) ?? null;
  if (source) {
    findings.push(...compareLeaves(source, null, shapes));
  }
  for (const d of flat) {
    if (d !== source) {
      findings.push(...compareLeaves(d, source, shapes));
    }
  }
  return findings;
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const jsonFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();

/** The website: `<dir>/<locale>.json`. */
export function auditWebCatalogue(root, dir = WEB_MESSAGES) {
  const abs = join(root, dir);
  if (!isDir(abs)) {
    return { findings: [], notes: [`${dir}: no website catalogue`] };
  }
  const findings = [];
  const docs = [];
  for (const f of jsonFiles(abs)) {
    const file = `${dir}/${f}`;
    const { value, error } = readJson(root, file);
    if (error) {
      findings.push({ file, key: '(file)', message: error });
    } else {
      docs.push({ locale: f.replace(/\.json$/, ''), file, value });
    }
  }
  const order = sourceFirst(docs.map((d) => d.locale));
  docs.sort((a, b) => order.indexOf(a.locale) - order.indexOf(b.locale));
  if (!docs.some((d) => d.locale === SOURCE_LOCALE) && docs.length) {
    findings.push({ file: `${dir}/${SOURCE_LOCALE}.json`, key: '(file)', message: 'source locale missing' });
  }
  findings.push(...auditDocuments(docs));
  return { findings, notes: [] };
}

/** The app: `<dir>/<locale>/<namespace>.json`. */
export function auditAppCatalogue(root, dir = APP_MESSAGES) {
  const abs = join(root, dir);
  if (!isDir(abs)) {
    return { findings: [], notes: [`${dir}: no app catalogue yet`] };
  }
  const findings = [];
  const locales = sourceFirst(readdirSync(abs).filter((l) => isDir(join(abs, l))));
  for (const f of readdirSync(abs).filter((f) => !isDir(join(abs, f)))) {
    findings.push({
      file: `${dir}/${f}`,
      key: '(file)',
      message: 'stray file: messages go in <locale>/<namespace>.json',
    });
  }
  if (!locales.includes(SOURCE_LOCALE)) {
    findings.push({ file: `${dir}/${SOURCE_LOCALE}/`, key: '(folder)', message: 'source locale missing' });
  }
  const namespaces = new Map(locales.map((l) => [l, jsonFiles(join(abs, l))]));
  const sourceNs = namespaces.get(SOURCE_LOCALE) ?? [];
  for (const l of locales) {
    if (l === SOURCE_LOCALE || !namespaces.has(SOURCE_LOCALE)) {
      continue;
    }
    for (const ns of sourceNs.filter((n) => !namespaces.get(l).includes(n))) {
      findings.push({ file: `${dir}/${l}/${ns}`, key: '(file)', message: `missing (${SOURCE_LOCALE} has it)` });
    }
    for (const ns of namespaces.get(l).filter((n) => !sourceNs.includes(n))) {
      findings.push({ file: `${dir}/${l}/${ns}`, key: '(file)', message: `extra (not in ${SOURCE_LOCALE})` });
    }
  }
  const allNs = [...new Set([...namespaces.values()].flat())].sort();
  for (const ns of allNs) {
    const docs = [];
    for (const l of locales) {
      if (!namespaces.get(l).includes(ns)) {
        continue;
      }
      const file = `${dir}/${l}/${ns}`;
      const { value, error } = readJson(root, file);
      if (error) {
        findings.push({ file, key: '(file)', message: error });
      } else {
        docs.push({ locale: l, file, value });
      }
    }
    findings.push(...auditDocuments(docs));
  }
  return { findings, notes: [] };
}

export function auditAll(root) {
  const app = auditAppCatalogue(root);
  const web = auditWebCatalogue(root);
  return { findings: [...app.findings, ...web.findings], notes: [...app.notes, ...web.notes] };
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { findings, notes } = auditAll(ROOT);
  for (const n of notes) {
    console.log(`note: ${n}`);
  }
  for (const f of findings) {
    console.log(`${relative(ROOT, join(ROOT, f.file))} ${f.key}: ${f.message}`);
  }
  if (findings.length) {
    console.error(`audit:i18n: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log('audit:i18n: catalogues agree across locales');
}
