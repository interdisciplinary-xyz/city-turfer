#!/usr/bin/env node
/**
 * `pnpm run audit:logs`: static privacy audit of src/ (CLAUDE.md: no raw coordinates in logs or
 * analytics in production builds). Mirrors the idea of empatalk's `audit:sentry-tags`.
 *
 * Fails on:
 *   1. any `console.*` call not guarded by `__DEV__` (inline `if (__DEV__) console.x`, the line
 *      after a brace-less `if (__DEV__)`, or inside an `if (__DEV__) { ... }` block);
 *   2. any `diagnostics.log(...)` payload that names lat, lon, latitude, longitude, coords,
 *      coordinate(s) (camelCase and snake_case identifiers are split into words first).
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

const COORD_WORDS = new Set(['lat', 'lon', 'latitude', 'longitude', 'coords', 'coordinate', 'coordinates']);
const ALLOW = /audit-logs-allow:(.*)$/;
const DEV_IF = /\bif\s*\((?:[^()]|\([^()]*\))*?(?<!!\s*)\b__DEV__\b(?:[^()]|\([^()]*\))*\)/;

function allowance(lines, i) {
  for (const j of [i, i - 1]) {
    const m = lines[j]?.match(ALLOW);
    if (m) return m[1].trim() || 'empty';
  }
  return null;
}

/** Strip a trailing `// comment` (naive: ignores `//` inside strings such as URLs after `:`). */
const code = (l) => l.replace(/(^|\s)\/\/.*$/, '$1');

/** @returns {{ line: number, rule: 'console' | 'diagnostics-coords' | 'allow-justification', message: string }[]} */
export function auditSource(text) {
  const findings = [];
  const lines = text.split('\n');
  const stack = []; // brace frames: true when opened by an `if (__DEV__) {`
  let inBlockComment = false;

  lines.forEach((raw, i) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end < 0) return;
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
    if (consoleAt >= 0) {
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
      if (src[k] === '{') stack.push(DEV_IF.test(src.slice(0, k)) && /\)\s*$/.test(src.slice(0, k)));
      else if (src[k] === '}') stack.pop();
    }
  });

  // diagnostics.log(...) payloads: balanced-paren extraction over the comment-stripped text.
  const flat = lines.map(code).join('\n');
  const callRe = /\bdiagnostics\??\.log\s*\(/g;
  let m;
  while ((m = callRe.exec(flat))) {
    let depth = 1;
    let k = callRe.lastIndex;
    while (k < flat.length && depth > 0) {
      if (flat[k] === '(') depth++;
      else if (flat[k] === ')') depth--;
      k++;
    }
    const args = flat.slice(callRe.lastIndex, k - 1);
    const words = (args.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g) ?? []).map((w) => w.toLowerCase());
    const bad = [...new Set(words.filter((w) => COORD_WORDS.has(w)))];
    if (bad.length) {
      const line = flat.slice(0, m.index).split('\n').length;
      const allowed = allowance(lines, line - 1);
      if (allowed === 'empty') {
        findings.push({ line, rule: 'allow-justification', message: 'audit-logs-allow needs a justification' });
      } else if (allowed === null) {
        findings.push({
          line,
          rule: 'diagnostics-coords',
          message: `diagnostics.log payload mentions ${bad.join(', ')}`,
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
      if (f !== '__tests__' && f !== 'test-support') walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') && !/\.test\.tsx?$/.test(f)) acc.push(p);
  }
  return acc;
}

export function auditTree(srcDir) {
  const out = [];
  for (const file of walk(srcDir)) {
    for (const f of auditSource(readFileSync(file, 'utf8'))) out.push({ file: relative(dirname(srcDir), file), ...f });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const findings = auditTree(join(root, 'src'));
  if (findings.length) {
    console.error(`audit:logs failed (${findings.length}):`);
    for (const f of findings) console.error(`  - ${f.file}:${f.line} [${f.rule}] ${f.message}`);
    process.exit(1);
  }
  console.log('audit:logs ok');
}
