#!/usr/bin/env node
// Docs audit: falsifiable signals about whether the docs still tell the truth.
// Conventions: docs/process/docs-conventions.md. Plain Node, no dependencies
// beyond Prettier (used only to format the generated index).
//
//   pnpm run audit:docs                       signals for every doc
//   pnpm run audit:docs -- --doc <path>       one file only
//   pnpm run audit:docs -- --fix-probes       rewrite every probe from code
//   pnpm run audit:docs -- --write-index      regenerate docs/INDEX.md from frontmatter
//   pnpm run audit:docs -- --strict           exit 1 on any error (for CI, later)
//
// Signals, never verdicts: deciding whether a doc is fixed, demoted or deleted is
// the /audit-docs command's job.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const docFilter = argv.includes('--doc') ? argv[argv.indexOf('--doc') + 1] : null;

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const STATUSES = {
  canonical: '✅',
  superseded: '⚠️',
  historical: '🕰️',
  proposed: '🚧',
  stale: '❗',
};
const REQUIRED_KEYS = ['status', 'verified', 'owner', 'scope', 'summary'];

/** Conventional names that keep their spelling (they mean something to GitHub). */
const CONVENTIONAL_NAMES = new Set(['README.md', 'INDEX.md', 'CHANGELOG.md', 'LICENSE.md', 'CONTRIBUTING.md']);

/**
 * docs/ root holds only README.md and INDEX.md. Exemptions, each with a reason:
 * poc-plan.md is referenced from CLAUDE.md and most skills and agents; moving it
 * to docs/product/ is a tracked follow-up, not part of introducing the audit.
 */
const ROOT_EXEMPT = new Set(['docs/poc-plan.md']);

/**
 * Paths a doc names on purpose before they exist (deliverables of a plan).
 * Reported as info, not as dead paths. Remove an entry once the file exists.
 */
const PLANNED_PATHS = new Set([
  'docs/spikes.md', // poc-plan.md M2: MapLibre spike decision record
  'docs/poc-report.md', // poc-plan.md M6: the PoC report
  'docs/roadmap.md', // add-feature skill: created after the PoC milestones
]);

/** Index sections in reading order: folder → [heading, what lives here]. */
const SECTIONS = [
  ['docs', 'The plan', 'The PoC plan: product, ubiquitous language, DDD design, milestones'],
  ['docs/engineering', 'How the system is built', 'Architecture, decisions, feature inventory'],
  ['docs/product', 'What we build and why', 'Product direction and roadmap'],
  ['docs/operations', 'Running it', 'Runbook, OTA releases, device diagnostics'],
  ['docs/quality', 'Testing and QA', 'Test inventory and QA policy'],
  ['docs/process', 'How we work', 'Release policy, docs conventions, session migration'],
  ['docs/sessions', 'Session logs', 'What was built and verified, one file per version'],
  ['docs/decisions', 'Decision records', 'Full write-ups of single decisions'],
  ['docs/plans', 'Live plans', 'Plans for work not shipped yet'],
  ['docs/archive', 'Archive', 'Point-in-time records; out of date on purpose'],
];

// ---------------------------------------------------------------------------
// Probes: derived numbers, evaluated from code. Add one here rather than typing
// a number into prose.
// ---------------------------------------------------------------------------

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const countMatches = (text, re) => (text.match(re) ?? []).length;

export const PROBES = {
  /** Bounded contexts: one directory per context in apps/mobile/src/contexts/. */
  contexts: () =>
    readdirSync(join(ROOT, 'apps/mobile/src/contexts')).filter((d) => isDir(join('apps/mobile/src/contexts', d)))
      .length,
  /** Achievements: one `id: '…'` per definition in the achievements list. */
  achievements: () =>
    countMatches(read('packages/core/src/contexts/achievements/domain/achievements.ts'), /^\s+id: '[a-z0-9-]+',/gm),
  /** Maestro flows run by the suite: entries of flowsOrder in apps/mobile/e2e/config.yaml. */
  'e2e-flows': () => {
    const text = read('apps/mobile/e2e/config.yaml');
    const block = text.slice(text.indexOf('flowsOrder:'));
    return countMatches(block, /^\s+- [\w-]+/gm);
  },
  /** SQLite migrations: `version: n` entries in apps/mobile/src/platform/migrations.ts. */
  migrations: () => countMatches(read('apps/mobile/src/platform/migrations.ts'), /^\s+version: \d+,/gm),
  /** Tracked docs under docs/. */
  docs: () => listFiles('docs').filter((f) => f.endsWith('.md')).length,
  /** HTTP operations in the generated API spec (apps/api/openapi.json). */
  'api-operations': () =>
    Object.values(JSON.parse(read('apps/api/openapi.json')).paths).reduce(
      (n, item) => n + ['get', 'put', 'post', 'patch', 'delete'].filter((m) => item[m]).length,
      0
    ),
};

const PROBE_RE = /<!-- probe:([\w-]+) -->([^<]*)<!-- \/probe -->/g;

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function isDir(p) {
  try {
    return statSync(join(ROOT, p)).isDirectory();
  } catch {
    return false;
  }
}

function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(join(ROOT, d))) {
      if (name === 'node_modules' || name === '.git') {
        continue;
      }
      const p = join(d, name);
      if (isDir(p)) {
        walk(p);
      } else {
        out.push(p);
      }
    }
  };
  if (isDir(dir)) {
    walk(dir);
  }
  return out.sort();
}

function scannedFiles() {
  const md = (files) => files.filter((f) => f.endsWith('.md') && basename(f) !== 'CHANGELOG.md');
  const files = [
    ...md(listFiles('docs')),
    ...['README.md', 'CLAUDE.md'].filter((f) => existsSync(join(ROOT, f))),
    ...md(listFiles('.claude')).filter((f) => !f.startsWith('.claude/worktrees/')),
  ];
  return docFilter ? files.filter((f) => f === relative(ROOT, resolve(docFilter))) : files;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Minimal YAML frontmatter reader: `key: value` and `key: [a, b]`, including the
 * indented continuation lines Prettier writes when it wraps a long value.
 */
export function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) {
    return null;
  }
  const end = text.indexOf('\n---', 4);
  if (end < 0) {
    return null;
  }
  const data = {};
  const lines = [];
  for (const line of text.slice(4, end).split('\n')) {
    if (/^\s+\S/.test(line) && lines.length) {
      lines[lines.length - 1] += ` ${line.trim()}`;
    } else {
      lines.push(line);
    }
  }
  for (const line of lines) {
    const m = line.match(/^([\w-]+):\s*(.*?)(\s+#.*)?$/);
    if (!m) {
      continue;
    }
    const [, key, raw] = m;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      data[key] = raw
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      data[key] = raw.replace(/^['"]|['"]$/g, '');
    }
  }
  return data;
}

/** Lines outside fenced code blocks, with 1-based line numbers. */
function proseLines(text) {
  const out = [];
  let fence = false;
  text.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      return;
    }
    if (!fence) {
      out.push([i + 1, line]);
    }
  });
  return out;
}

/** GitHub's heading anchor slug. */
export function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function anchorsOf(file) {
  const seen = new Map();
  const anchors = new Set();
  for (const [, line] of proseLines(readFileSync(join(ROOT, file), 'utf8'))) {
    const m = line.match(/^#{1,6}\s+(.*?)\s*#*$/);
    if (!m) {
      continue;
    }
    const base = slug(m[1].replace(/`/g, ''));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const findings = [];
const add = (severity, file, line, kind, message) => findings.push({ severity, file, line, kind, message });

const PATH_PREFIXES = ['apps/', 'packages/', 'tools/', 'docs/', '.claude/', '.github/'];
const STALE_PREFIXES = ['src/', 'e2e/', 'modules/', 'plugins/', 'assets/', 'app/', 'scripts/']; // pre-monorepo roots (now under apps/mobile/) and older stale roots
const CONTEXTS = isDir('apps/mobile/src/contexts') ? readdirSync(join(ROOT, 'apps/mobile/src/contexts')) : [];
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.md', '.json'];

function pathExists(p) {
  return EXTENSIONS.some((ext) => existsSync(join(ROOT, p + ext)));
}

let ignoredCache = null;
function isGitIgnored(p) {
  ignoredCache ??= new Map();
  if (!ignoredCache.has(p)) {
    try {
      execFileSync('git', ['check-ignore', '-q', p], { cwd: ROOT, stdio: 'ignore' });
      ignoredCache.set(p, true);
    } catch {
      ignoredCache.set(p, false);
    }
  }
  return ignoredCache.get(p);
}

/** Turn an inline-code token into a repo path to check, or null if it isn't one. */
export function candidatePath(token) {
  if (/\s|<|>|\$|^https?:|@/.test(token)) {
    return null;
  }
  let p = token.replace(/[…]+$/, '').replace(/(#L\d+|:\d+(-\d+)?)$/, '');
  const glob = p.search(/[*{?[]/);
  if (glob >= 0) {
    p = p.slice(0, glob);
  }
  if (!p.includes('/')) {
    return null;
  }
  const first = p.split('/')[0];
  if ([...PATH_PREFIXES, ...STALE_PREFIXES].some((pre) => p.startsWith(pre))) {
    return p;
  }
  if (CONTEXTS.includes(first)) {
    return `apps/mobile/src/contexts/${p}`;
  } // context-relative, e.g. recording/domain/x.ts
  return null;
}

function checkFrontmatter(file, text, fm) {
  if (!file.startsWith('docs/')) {
    return;
  }
  if (!fm) {
    add('error', file, 1, 'frontmatter', 'missing frontmatter (status, verified, owner, scope, summary)');
    return;
  }
  for (const key of REQUIRED_KEYS) {
    if (fm[key] === undefined || fm[key] === '') {
      add('error', file, 1, 'frontmatter', `missing \`${key}:\``);
    }
  }
  if (fm.status && !(fm.status in STATUSES)) {
    add('error', file, 1, 'frontmatter', `status \`${fm.status}\` is not one of ${Object.keys(STATUSES).join(' | ')}`);
  }
  if (fm.verified) {
    const d = new Date(`${fm.verified}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.verified) || Number.isNaN(d.getTime())) {
      add('error', file, 1, 'frontmatter', `verified \`${fm.verified}\` is not a YYYY-MM-DD date`);
    } else if (d.getTime() > Date.now()) {
      add('error', file, 1, 'frontmatter', 'verified date is in the future');
    }
  }
  if (fm.scope !== undefined && !Array.isArray(fm.scope)) {
    add('error', file, 1, 'frontmatter', 'scope must be a list: `scope: [path, path]`');
  } else if (Array.isArray(fm.scope)) {
    for (const p of fm.scope) {
      if (!pathExists(p.replace(/[*{].*$/, ''))) {
        add('warn', file, 1, 'scope', `scope path \`${p}\` does not exist`);
      }
    }
  }
  if (fm.status === 'superseded' && !/\.md|\]\(/.test(fm.summary ?? '')) {
    add('warn', file, 1, 'frontmatter', 'superseded doc: summary must name its successor');
  }
}

function checkPlacement(file) {
  if (!file.startsWith('docs/')) {
    return;
  }
  const name = basename(file);
  if (!CONVENTIONAL_NAMES.has(name) && !/^[a-z0-9]+([.-][a-z0-9]+)*\.md$/.test(name)) {
    add('warn', file, 1, 'filename', 'not kebab-case (CityTurfer uses kebab-case for every file)');
  }
  if (dirname(file) === 'docs' && !CONVENTIONAL_NAMES.has(name) && !ROOT_EXEMPT.has(file)) {
    add('warn', file, 1, 'placement', 'docs/ root holds only README.md and INDEX.md; move it into a folder');
  }
}

function checkReviewDebt(file, fm) {
  if (!fm?.verified || !Array.isArray(fm.scope) || fm.scope.length === 0) {
    return;
  }
  try {
    const out = execFileSync(
      'git',
      ['rev-list', '--count', `--since=${fm.verified}T23:59:59`, 'HEAD', '--', ...fm.scope],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    const n = Number(out);
    if (n > 0) {
      add(
        n >= 10 ? 'warn' : 'info',
        file,
        1,
        'review-debt',
        `${n} commits touched its scope since verified ${fm.verified}`
      );
    }
  } catch {
    // not a git checkout: no review-debt signal
  }
}

function checkPathsAndLinks(file, text, historical) {
  const deadSeverity = historical ? 'info' : 'error';
  for (const [n, line] of proseLines(text)) {
    for (const m of line.matchAll(/`([^`\n]+)`/g)) {
      const p = candidatePath(m[1]);
      if (!p) {
        continue;
      }
      if (PLANNED_PATHS.has(p)) {
        if (pathExists(p)) {
          add('warn', file, n, 'planned-path', `\`${m[1]}\` exists now: drop it from PLANNED_PATHS`);
        } else {
          add('info', file, n, 'planned-path', `\`${m[1]}\` is planned, not written yet`);
        }
      } else if (!pathExists(p) && !isGitIgnored(p)) {
        add(deadSeverity, file, n, 'dead-path', `\`${m[1]}\` does not exist`);
      }
    }
    const links = [...line.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g), ...line.matchAll(/^\[[^\]]+\]:\s+(\S+)/g)];
    for (const m of links) {
      const target = m[1];
      if (/^(https?:|mailto:|tel:)/.test(target)) {
        continue;
      }
      const [pathPart, anchor] = target.split('#');
      const resolved = pathPart ? relative(ROOT, resolve(ROOT, dirname(file), decodeURI(pathPart))) : file;
      if (pathPart && !existsSync(join(ROOT, resolved))) {
        add(deadSeverity, file, n, 'broken-link', `link target \`${target}\` does not exist`);
      } else if (anchor && resolved.endsWith('.md') && !anchorsOf(resolved).has(anchor)) {
        add(deadSeverity, file, n, 'broken-link', `anchor \`#${anchor}\` not found in ${resolved}`);
      }
    }
  }
}

function checkProbes(file, text) {
  for (const m of text.matchAll(PROBE_RE)) {
    const [, name, value] = m;
    const line = text.slice(0, m.index).split('\n').length;
    if (!PROBES[name]) {
      add('error', file, line, 'probe', `unknown probe \`${name}\` (see PROBES in tools/docs-audit.mjs)`);
      continue;
    }
    const actual = String(PROBES[name]());
    if (value.trim() !== actual) {
      add('error', file, line, 'probe-drift', `probe:${name} says ${value}, code says ${actual}`);
    }
  }
}

function fixProbes(file, text) {
  const next = text.replace(PROBE_RE, (all, name) =>
    PROBES[name] ? `<!-- probe:${name} -->${PROBES[name]()}<!-- /probe -->` : all
  );
  if (next !== text) {
    writeFileSync(join(ROOT, file), next);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

const INDEX = 'docs/INDEX.md';
const START = '<!-- docs-index:start -->';
const END = '<!-- docs-index:end -->';

function sectionOf(file) {
  const dir = dirname(file);
  const match = SECTIONS.filter(([folder]) => dir === folder || dir.startsWith(`${folder}/`)).pop();
  return match ?? [dir, dir, ''];
}

function buildIndexBody() {
  const docs = listFiles('docs').filter((f) => f.endsWith('.md') && f !== INDEX);
  const groups = new Map();
  for (const f of docs) {
    const [folder] = sectionOf(f);
    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder).push(f);
  }
  const order = [...SECTIONS.map(([folder]) => folder), ...[...groups.keys()].sort()];
  const lines = [
    '_Generated by `pnpm run audit:docs -- --write-index`. Do not hand-edit: change the doc’s frontmatter and re-run._',
    '',
    `Status: ${Object.entries(STATUSES)
      .map(([s, icon]) => `${icon} ${s}`)
      .join(' · ')}. Conventions: [docs-conventions.md](process/docs-conventions.md).`,
  ];
  for (const folder of [...new Set(order)]) {
    const files = groups.get(folder);
    if (!files) {
      continue;
    }
    const [, heading, about] = SECTIONS.find(([f]) => f === folder) ?? [folder, folder, ''];
    lines.push('', `## ${heading}`, '', `\`${folder}/\`${about ? ` — ${about}.` : ''}`, '');
    for (const f of files) {
      const fm = parseFrontmatter(readFileSync(join(ROOT, f), 'utf8')) ?? {};
      const rel = relative('docs', f);
      const icon = STATUSES[fm.status] ?? '❔';
      lines.push(`- ${icon} [\`${rel}\`](${rel}): ${fm.summary ?? '_no frontmatter_'}`);
    }
  }
  return lines.join('\n');
}

async function format(file, text) {
  try {
    const prettier = await import('prettier');
    const options = (await prettier.resolveConfig(join(ROOT, file))) ?? {};
    return await prettier.format(text, { ...options, filepath: join(ROOT, file) });
  } catch {
    return text;
  }
}

async function renderIndex() {
  const current = existsSync(join(ROOT, INDEX)) ? read(INDEX) : '';
  const head =
    current.includes(START) && current.includes(END)
      ? current.slice(0, current.indexOf(START))
      : [
          '---',
          'status: canonical',
          `verified: ${new Date().toISOString().slice(0, 10)}`,
          'owner: founder',
          'scope: [tools/docs-audit.mjs, docs]',
          'summary: Every doc with its status, generated from frontmatter',
          '---',
          '',
          '# Docs index',
          '',
          '',
        ].join('\n');
  const tail = current.includes(END) ? current.slice(current.indexOf(END) + END.length) : '\n';
  return format(INDEX, `${head}${START}\n\n${buildIndexBody()}\n\n${END}${tail}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const files = scannedFiles();
  const touched = [];
  if (flag('--fix-probes')) {
    for (const f of files) {
      if (fixProbes(f, read(f))) {
        touched.push(f);
      }
    }
    for (const f of touched) {
      writeFileSync(join(ROOT, f), await format(f, read(f)));
    }
  }
  if (flag('--write-index')) {
    writeFileSync(join(ROOT, INDEX), await renderIndex());
    touched.push(INDEX);
  }

  for (const f of files) {
    const text = read(f);
    const fm = parseFrontmatter(text);
    checkFrontmatter(f, text, fm);
    checkPlacement(f);
    checkReviewDebt(f, fm);
    checkPathsAndLinks(f, text, fm?.status === 'historical' || f.startsWith('docs/archive/'));
    checkProbes(f, text);
  }
  if (!docFilter && (!existsSync(join(ROOT, INDEX)) || read(INDEX) !== (await renderIndex()))) {
    add('warn', INDEX, 1, 'index', 'out of date: run `pnpm run audit:docs -- --write-index`');
  }

  for (const f of touched) {
    console.log(`wrote ${f}`);
  }
  const order = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
  const label = { error: 'ERROR', warn: 'WARN ', info: 'info ' };
  for (const x of findings) {
    console.log(`${label[x.severity]} ${x.file}:${x.line}  [${x.kind}] ${x.message}`);
  }
  const count = (s) => findings.filter((x) => x.severity === s).length;
  console.log(
    `\n${files.length} files scanned · ${count('error')} errors · ${count('warn')} warnings · ${count('info')} info`
  );
  if (flag('--strict') && count('error') > 0) {
    process.exit(1);
  }
}

await main();
