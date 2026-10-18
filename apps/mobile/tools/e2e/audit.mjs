#!/usr/bin/env node
// E2E coverage audit (`pnpm run e2e:audit`). Static checks that keep the Maestro suite, its
// config and docs/quality/e2e.md consistent. Mirrors empatalk's e2e-coverage-audit idea.
//   1. every e2e/*.yaml flow is in config.yaml flowsOrder, and vice versa
//   2. 08-sign-out runs last (it signs the session out)
//   3. flow tags come from ALLOWED_TAGS
//   4. every critical path (CP-n) in docs/quality/e2e.md maps to >= 1 existing flow (rows that
//      state "unit-only" are the declared gaps and may have none)
//   5. no commented-out steps in flows
//   6. every testID used by a flow exists in src (static or `${...}` template)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWED_TAGS = ['auth', 'recording', 'background', 'history', 'turf', 'me', 'dashboard'];
export const LAST_FLOW = '08-sign-out';

/** Flow names (no extension) of top-level e2e/*.yaml, excluding config, dotfiles and subflows. */
export function listFlows(e2eDir) {
  return readdirSync(e2eDir)
    .filter((f) => f.endsWith('.yaml') && f !== 'config.yaml' && !f.startsWith('.'))
    .filter((f) => statSync(join(e2eDir, f)).isFile())
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort();
}

/** flowsOrder entries from config.yaml (simple list under `flowsOrder:`). */
export function parseFlowsOrder(configText) {
  const lines = configText.split('\n');
  const start = lines.findIndex((l) => /^\s*flowsOrder:\s*$/.test(l));
  if (start < 0) {
    return [];
  }
  const out = [];
  for (const l of lines.slice(start + 1)) {
    const m = l.match(/^\s*-\s*([^\s#]+)/);
    if (m) {
      out.push(m[1].replace(/\.yaml$/, ''));
    } else if (l.trim() && !l.trim().startsWith('#')) {
      break;
    }
  }
  return out;
}

export function parseTags(flowText) {
  const header = flowText.split(/^---\s*$/m)[0] ?? '';
  const m = header.match(/^tags:\s*\[([^\]]*)\]/m);
  return m
    ? m[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : null;
}

/** Commented-out steps: `# - tapOn: ...` style lines. Prose comments are fine. */
export function commentedOutSteps(flowText) {
  return flowText
    .split('\n')
    .map((l, i) => ({ l, line: i + 1 }))
    .filter(({ l }) => /^\s*#\s*-\s+\S/.test(l))
    .map(({ l, line }) => `line ${line}: ${l.trim()}`);
}

/** Static `id: 'x'` references in a flow (subflows are scanned separately). */
export function flowTestIds(flowText) {
  const ids = new Set();
  // Negative assertions (assertNotVisible / notVisible) may legitimately name an id that is absent.
  for (const line of flowText.split('\n')) {
    if (/assertNotVisible|notVisible/.test(line)) {
      continue;
    }
    for (const m of line.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)) {
      ids.add(m[1]);
    }
  }
  return [...ids];
}

/** Subflow files referenced via runFlow (string or `file:` form). */
export function referencedSubflows(flowText) {
  const out = new Set();
  for (const m of flowText.matchAll(/(subflows\/[\w.-]+\.yaml)/g)) {
    out.add(m[1]);
  }
  return [...out];
}

/** Collect testIDs declared in src: static literals and `${...}` templates (as RegExp). */
export function collectSourceTestIds(srcText) {
  const literals = new Set();
  const patterns = [];
  const add = (raw) => {
    if (raw.includes('${')) {
      const re = raw
        .split(/\$\{[^}]*\}/)
        .map((p) => p.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&'))
        .join('.+');
      patterns.push(new RegExp(`^${re}$`));
    } else {
      literals.add(raw);
    }
  };
  const re = /(?:testID|tabBarButtonTestID)\s*[=:]\s*(?:\{\s*)?(['"`])([^'"`]+)\1/g;
  for (const m of srcText.matchAll(re)) {
    add(m[2]);
  }
  return { literals, patterns };
}

export function sourceHasTestId(ids, id) {
  return ids.literals.has(id) || ids.patterns.some((p) => p.test(id));
}

/** CP-n -> flow names, from the `| CP-n |` rows of the coverage table in e2e.md. */
export function parseCriticalPaths(md) {
  const paths = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*(CP-\d+)\s*\|/);
    if (!m) {
      continue;
    }
    const flows = [...line.matchAll(/`(\d{2}-[a-z0-9-]+)`/g)].map((x) => x[1]);
    paths.push({ id: m[1], flows, unitOnly: /unit-only/i.test(line) });
  }
  return paths;
}

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      walk(p, acc);
    } else if (/\.(tsx?|jsx?)$/.test(f) && !p.includes('__tests__')) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * Pure audit over the app root (e2e/, src/). `docsRoot` holds docs/quality/e2e.md: the repo root in
 * the monorepo, the app root in test fixtures. Returns { errors, summary }.
 */
export function audit(root, docsRoot = root) {
  const errors = [];
  const e2eDir = join(root, 'e2e');
  const flows = listFlows(e2eDir);
  const order = parseFlowsOrder(readFileSync(join(e2eDir, 'config.yaml'), 'utf8'));

  for (const f of flows) {
    if (!order.includes(f)) {
      errors.push(`flow ${f}.yaml is not in config.yaml flowsOrder`);
    }
  }
  for (const f of order) {
    if (!flows.includes(f)) {
      errors.push(`config.yaml flowsOrder lists ${f} but e2e/${f}.yaml does not exist`);
    }
  }
  if (order.length && order[order.length - 1] !== LAST_FLOW) {
    errors.push(`${LAST_FLOW} must be last in flowsOrder (it signs out)`);
  }
  if (new Set(order).size !== order.length) {
    errors.push('flowsOrder contains duplicates');
  }

  const srcFiles = existsSync(join(root, 'src')) ? walk(join(root, 'src')) : [];
  const ids = collectSourceTestIds(srcFiles.map((f) => readFileSync(f, 'utf8')).join('\n'));

  for (const f of flows) {
    const text = readFileSync(join(e2eDir, `${f}.yaml`), 'utf8');
    const tags = parseTags(text);
    if (!tags || tags.length === 0) {
      errors.push(`${f}: missing tags`);
    } else {
      for (const t of tags) {
        if (!ALLOWED_TAGS.includes(t)) {
          errors.push(`${f}: tag "${t}" not in allowed set (${ALLOWED_TAGS.join(', ')})`);
        }
      }
    }
    for (const c of commentedOutSteps(text)) {
      errors.push(`${f}: commented-out step (${c})`);
    }
    const texts = [text];
    for (const sf of referencedSubflows(text)) {
      const p = join(e2eDir, sf);
      if (existsSync(p)) {
        texts.push(readFileSync(p, 'utf8'));
      } else {
        errors.push(`${f}: runs missing subflow ${sf}`);
      }
    }
    for (const id of new Set(texts.flatMap(flowTestIds))) {
      if (!sourceHasTestId(ids, id)) {
        errors.push(`${f}: testID "${id}" not found in src`);
      }
    }
  }

  const mdPath = join(docsRoot, 'docs/quality/e2e.md');
  let cps = [];
  if (!existsSync(mdPath)) {
    errors.push('docs/quality/e2e.md is missing');
  } else {
    cps = parseCriticalPaths(readFileSync(mdPath, 'utf8'));
    if (cps.length === 0) {
      errors.push('docs/quality/e2e.md has no CP-n rows');
    }
    for (const cp of cps) {
      if (cp.flows.length === 0 && !cp.unitOnly) {
        errors.push(`${cp.id}: maps to no flow (declare "unit-only" if intentional)`);
      }
      for (const f of cp.flows) {
        if (!flows.includes(f)) {
          errors.push(`${cp.id}: flow ${f} does not exist`);
        }
      }
    }
  }
  return { errors, summary: { flows: flows.length, order: order.length, criticalPaths: cps.length } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); // apps/mobile
  const { errors, summary } = audit(root, resolve(root, '../..'));
  if (errors.length) {
    console.error(`e2e audit failed (${errors.length}):`);
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }
  console.log(`e2e audit ok: ${summary.flows} flows, ${summary.criticalPaths} critical paths`);
}
