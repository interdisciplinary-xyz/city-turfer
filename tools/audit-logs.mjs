#!/usr/bin/env node
/**
 * `pnpm run audit:logs`: static privacy audit of src/ (CLAUDE.md: no raw coordinates in logs or
 * analytics in production builds). Mirrors the idea of empatalk's `audit:sentry-tags`.
 *
 * Fails on:
 *   1. any `console.*` call not guarded by `__DEV__` (inline `if (__DEV__) console.x`, the line
 *      after a brace-less `if (__DEV__)`, or inside an `if (__DEV__) { ... }` block);
 *   2. any `diagnostics.log(...)` payload that names lat, lon, lng, latitude, longitude, coords,
 *      coordinate(s), waypoint(s) (camelCase and snake_case identifiers are split into words first);
 *   3. any error-report call (`.report(` on an ErrorReporter, `reportError(`, Sentry's
 *      `captureException` / `captureMessage` / `captureEvent`) whose arguments name one of those
 *      words outside a plain string literal ('coords-load' as a code is a label, `{ lat }` is data).
 *      Rule 3 also runs over apps/api/src and apps/web/src (rules 1 and 2 are the app's).
 *
 * Allow-list: a comment on the same line or the line above
 *     // audit-logs-allow: <justification>
 * The justification is mandatory; an empty one is itself an error. Keep these rare and reviewed.
 *
 * Limits (regex, not an AST): spread payloads (`...report`) are not inspected, and a `console`
 * mention inside a string or comment on a code line may be flagged (use the allow-list).
 * Tests (`__tests__`, `test-support`) are skipped.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COORD_WORDS = new Set([
  'lat',
  'lon',
  'lng',
  'latitude',
  'longitude',
  'coords',
  'coordinate',
  'coordinates',
  'waypoint',
  'waypoints',
]);
/** Calls that hand an error to crash reporting (the ErrorReporter port, the API's hook, Sentry). */
const REPORT_CALL = /(?:\.report|\breportError\??\.?|\bcapture(?:Exception|Message|Event))\s*\(/g;
/** Every rule; a tree may run a subset (`auditTree(dir, { rules })`). */
export const ALL_RULES = ['console', 'diagnostics-coords', 'report-coords'];
const ALLOW = /audit-logs-allow:(.*)$/;
const DEV_IF = /\bif\s*\((?:[^()]|\([^()]*\))*?(?<!!\s*)\b__DEV__\b(?:[^()]|\([^()]*\))*\)/;

function allowance(lines, i) {
  for (const j of [i, i - 1]) {
    const m = lines[j]?.match(ALLOW);
    if (m) {
      return m[1].trim() || 'empty';
    }
  }
  return null;
}

/** Strip a trailing `// comment` (naive: ignores `//` inside strings such as URLs after `:`). */
const code = (l) => l.replace(/(^|\s)\/\/.*$/, '$1');

/** The argument text of each call `re` matches (balanced parentheses), with its 1-based line. */
function callArgs(flat, re) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(flat))) {
    let depth = 1;
    let k = re.lastIndex;
    while (k < flat.length && depth > 0) {
      if (flat[k] === '(') {
        depth++;
      } else if (flat[k] === ')') {
        depth--;
      }
      k++;
    }
    out.push({ args: flat.slice(re.lastIndex, k - 1), line: flat.slice(0, m.index).split('\n').length });
  }
  return out;
}

const coordWords = (args) => [
  ...new Set(
    (args.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g) ?? [])
      .map((w) => w.toLowerCase())
      .filter((w) => COORD_WORDS.has(w))
  ),
];

/** Plain '…' and "…" literals emptied (template literals kept: `${lat}` is data). */
const withoutStrings = (s) => s.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");

/**
 * @param {string} text
 * @param {{ rules?: readonly string[] }} [options] which rules run (default: all)
 * @returns {{ line: number, rule: 'console' | 'diagnostics-coords' | 'report-coords' | 'allow-justification', message: string }[]}
 */
export function auditSource(text, { rules = ALL_RULES } = {}) {
  const findings = [];
  const lines = text.split('\n');
  const stack = []; // brace frames: true when opened by an `if (__DEV__) {`
  let inBlockComment = false;

  lines.forEach((raw, i) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end < 0) {
        return;
      }
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    line = line.replace(/\/\*.*?\*\//g, '');
    if (line.includes('/*')) {
      line = line.slice(0, line.indexOf('/*'));
      inBlockComment = true;
    }
    const src = code(line);

    // Walk braces so console calls can see enclosing `if (__DEV__) {` frames.
    const consoleAt = src.search(/\bconsole\s*\./);
    const devOnLine = consoleAt >= 0 && DEV_IF.test(src.slice(0, consoleAt));
    const prev = i > 0 ? code(lines[i - 1] ?? '').trim() : '';
    const braceless = DEV_IF.test(prev) && !prev.endsWith('{');
    if (consoleAt >= 0 && rules.includes('console')) {
      const inFrame = stack.some(Boolean);
      const allowed = allowance(lines, i);
      if (allowed === 'empty') {
        findings.push({ line: i + 1, rule: 'allow-justification', message: 'audit-logs-allow needs a justification' });
      } else if (!inFrame && !devOnLine && !braceless && allowed === null) {
        findings.push({
          line: i + 1,
          rule: 'console',
          message: `unguarded ${src.slice(consoleAt).trim()} (wrap in if (__DEV__))`,
        });
      }
    }
    for (let k = 0; k < src.length; k++) {
      if (src[k] === '{') {
        stack.push(DEV_IF.test(src.slice(0, k)) && /\)\s*$/.test(src.slice(0, k)));
      } else if (src[k] === '}') {
        stack.pop();
      }
    }
  });

  // diagnostics.log(...) payloads and error reports: balanced-paren extraction over the comment-stripped text.
  const flat = lines.map(code).join('\n');
  const checks = [
    { rule: 'diagnostics-coords', re: /\bdiagnostics\??\.log\s*\(/g, what: 'diagnostics.log payload', prep: (a) => a },
    { rule: 'report-coords', re: REPORT_CALL, what: 'error report', prep: withoutStrings },
  ];
  for (const { rule, re, what, prep } of checks.filter((c) => rules.includes(c.rule))) {
    for (const { args, line } of callArgs(flat, re)) {
      const bad = coordWords(prep(args));
      if (!bad.length) {
        continue;
      }
      const allowed = allowance(lines, line - 1);
      if (allowed === 'empty') {
        findings.push({ line, rule: 'allow-justification', message: 'audit-logs-allow needs a justification' });
      } else if (allowed === null) {
        findings.push({
          line,
          rule,
          message: `${what} mentions ${bad.join(', ')} (reports and logs stay coordinate-free)`,
        });
      }
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (f !== '__tests__' && f !== 'test-support') {
        walk(p, acc);
      }
    } else if (/\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') && !/\.test\.tsx?$/.test(f)) {
      acc.push(p);
    }
  }
  return acc;
}

/** The trees `pnpm run audit:logs` reads, and the rules each runs. */
export const TREES = [
  { dir: 'apps/mobile/src', rules: ALL_RULES },
  { dir: 'apps/api/src', rules: ['report-coords'] },
  { dir: 'apps/web/src', rules: ['report-coords'] },
];

export function auditTree(srcDir, { rules = ALL_RULES } = {}) {
  const out = [];
  for (const file of walk(srcDir)) {
    for (const f of auditSource(readFileSync(file, 'utf8'), { rules })) {
      out.push({ file: relative(dirname(srcDir), file), ...f });
    }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const findings = TREES.flatMap(({ dir, rules }) =>
    auditTree(join(root, dir), { rules }).map((f) => ({ ...f, file: join(dirname(dir), f.file) }))
  );
  if (findings.length) {
    console.error(`audit:logs failed (${findings.length}):`);
    for (const f of findings) {
      console.error(`  - ${f.file}:${f.line} [${f.rule}] ${f.message}`);
    }
    process.exit(1);
  }
  console.log('audit:logs ok');
}
