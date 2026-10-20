#!/usr/bin/env node
/**
 * `pnpm run audit:harness`: is the Claude Code harness (.claude/ + CLAUDE.md) still wired to the code?
 * Complements `pnpm run audit:docs`, which already checks dead paths and links inside .claude/*.md.
 *
 * Errors (exit 1):
 *   - agent / skill / command frontmatter: missing, name ≠ file or folder, empty or over-long
 *     description, unknown tool, unknown model
 *   - CLAUDE.md "Claude Code setup" lists ≠ the agents, skills and commands on disk
 *   - .claude/settings.json hooks that point at a missing or non-executable script
 *   - `pnpm run <script>` / `pnpm --filter <pkg> <script>` / `pnpm -C <dir> run <script>` naming a
 *     script that does not exist
 *   - a `<name>-engineer|architect|reviewer|designer` agent or a `<name>` skill that does not exist
 * Warnings: the old product name in agent/skill text.
 *
 *   pnpm run audit:harness            report, exit 1 on errors
 *   pnpm run audit:harness -- --json  machine-readable findings
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from './docs-audit.mjs';

export const KNOWN_TOOLS = new Set([
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Grep',
  'Glob',
  'Bash',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
  'TodoWrite',
  'Agent',
  'Task',
  'Skill',
  'AskUserQuestion',
]);
export const KNOWN_MODELS = new Set(['opus', 'sonnet', 'haiku', 'fable', 'inherit']);
const AGENT_SUFFIX = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:engineer|architect|reviewer|designer))\b/g;
const STALE_NAMES = [{ re: /\bTurfTrack\b/, now: 'CityTurfer' }];
/**
 * Skills the harness may name that live outside .claude/skills/ (user-level skills, built-ins).
 * A teammate without them still works: the referencing skill says what the rule is.
 */
export const EXTERNAL_SKILLS = new Set([
  'gsap-react',
  'code-review',
  'simplify',
  'security-review',
  'skill-creator',
  'copywriting',
  'frontend-design',
  'ui-ux-pro-max',
  'next-best-practices',
  'web-vitals-a11y-audit',
  'seo-checker',
  'data-privacy-reviewer',
]);

/** Fenced code blocks and inline code spans: the only places a command is meant literally. */
export function codeText(markdown) {
  const out = [];
  let fence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) {
      out.push(line.replace(/(^|\s)#.*$/, ''));
    } else {
      out.push(...[...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    }
  }
  return out.join('\n');
}
/** pnpm subcommands that are not package scripts. */
const PNPM_BUILTINS = new Set([
  'install',
  'i',
  'add',
  'remove',
  'exec',
  'dlx',
  'why',
  'list',
  'ls',
  'outdated',
  'update',
  'up',
  'store',
  'link',
  'prune',
  'import',
  'config',
  'run',
  'create',
  'audit',
  'publish',
  'pack',
  'rebuild',
  'licenses',
  'patch',
  'approve-builds',
]);

/** Every `name` listed in a CLAUDE.md bullet such as "- Skills (`.claude/skills/`): `a`, `b`." */
export function listedNames(claudeMd, label) {
  const start = claudeMd.search(new RegExp(`^- ${label} \\(`, 'm'));
  if (start < 0) {
    return null;
  }
  const rest = claudeMd.slice(start);
  const end = rest.slice(2).search(/\n(- |\n|#)/);
  const bullet = end < 0 ? rest : rest.slice(0, end + 2);
  return [...bullet.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1].replace(/^\//, '').replace(/\s*\(.*$/, ''))
    .filter((n) => !n.includes('/') && !n.includes('.'));
}

/** Script references in markdown or shell text. */
export function scriptReferences(text) {
  const refs = [];
  for (const m of text.matchAll(
    /\bpnpm\s+(?:(-C|--dir)\s+(\S+)\s+|(--filter|-F)\s+(\S+)\s+)?(run\s+)?([a-z][\w:.-]*)/g
  )) {
    const [, dirFlag, dir, , filter, run, name] = m;
    if (!run && PNPM_BUILTINS.has(name)) {
      continue;
    }
    if (name === 'run') {
      continue;
    }
    refs.push({ name, dir: dirFlag ? dir : null, filter: filter ?? null });
  }
  return refs;
}

export function auditHarness(root) {
  const findings = [];
  const add = (severity, file, kind, message) => findings.push({ severity, file, kind, message });
  const read = (p) => readFileSync(join(root, p), 'utf8');
  const ls = (p) => (existsSync(join(root, p)) ? readdirSync(join(root, p)) : []);

  const agents = ls('.claude/agents')
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
  const skills = ls('.claude/skills').filter((d) => existsSync(join(root, '.claude/skills', d, 'SKILL.md')));
  const commands = ls('.claude/commands')
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));

  // --- frontmatter -------------------------------------------------------
  const texts = new Map();
  const checkDescription = (file, fm) => {
    if (!fm.description) {
      add('error', file, 'frontmatter', 'missing `description:` (it decides when Claude uses this)');
    } else if (fm.description.length > 1024) {
      add('error', file, 'frontmatter', `description is ${fm.description.length} chars (max 1024)`);
    }
  };
  for (const name of agents) {
    const file = `.claude/agents/${name}.md`;
    const text = read(file);
    texts.set(file, text);
    const fm = parseFrontmatter(text);
    if (!fm) {
      add('error', file, 'frontmatter', 'missing frontmatter');
      continue;
    }
    if (fm.name !== name) {
      add('error', file, 'frontmatter', `name \`${fm.name}\` ≠ file name \`${name}\``);
    }
    checkDescription(file, fm);
    for (const tool of (fm.tools ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)) {
      if (!KNOWN_TOOLS.has(tool) && !tool.startsWith('mcp__')) {
        add('error', file, 'frontmatter', `unknown tool \`${tool}\``);
      }
    }
    if (fm.model && !KNOWN_MODELS.has(fm.model) && !fm.model.startsWith('claude-')) {
      add('error', file, 'frontmatter', `unknown model \`${fm.model}\``);
    }
  }
  for (const name of skills) {
    const file = `.claude/skills/${name}/SKILL.md`;
    const text = read(file);
    texts.set(file, text);
    const fm = parseFrontmatter(text);
    if (!fm) {
      add('error', file, 'frontmatter', 'missing frontmatter');
      continue;
    }
    if (fm.name !== name) {
      add('error', file, 'frontmatter', `name \`${fm.name}\` ≠ folder name \`${name}\``);
    }
    checkDescription(file, fm);
  }
  for (const name of commands) {
    const file = `.claude/commands/${name}.md`;
    const text = read(file);
    texts.set(file, text);
    const fm = parseFrontmatter(text);
    if (!fm) {
      add('error', file, 'frontmatter', 'missing frontmatter');
    } else {
      checkDescription(file, fm);
    }
  }

  // --- CLAUDE.md lists ---------------------------------------------------
  if (existsSync(join(root, 'CLAUDE.md'))) {
    const claudeMd = read('CLAUDE.md');
    texts.set('CLAUDE.md', claudeMd);
    for (const [label, onDisk] of [
      ['Skills', skills],
      ['Agents', agents],
      ['Commands', commands],
    ]) {
      const listed = listedNames(claudeMd, label);
      if (listed === null) {
        if (onDisk.length) {
          add('error', 'CLAUDE.md', 'setup-list', `no "- ${label} (…)" bullet under Claude Code setup`);
        }
        continue;
      }
      for (const n of onDisk.filter((x) => !listed.includes(x))) {
        add('error', 'CLAUDE.md', 'setup-list', `${label.toLowerCase()} \`${n}\` exists but is not listed`);
      }
      for (const n of listed.filter((x) => !onDisk.includes(x))) {
        add('error', 'CLAUDE.md', 'setup-list', `${label.toLowerCase()} \`${n}\` is listed but does not exist`);
      }
    }
  }

  // --- settings.json hooks -----------------------------------------------
  for (const settings of ['.claude/settings.json', '.claude/settings.local.json']) {
    if (!existsSync(join(root, settings))) {
      continue;
    }
    let json;
    try {
      json = JSON.parse(read(settings));
    } catch (e) {
      add('error', settings, 'settings', `invalid JSON: ${e.message}`);
      continue;
    }
    for (const [event, groups] of Object.entries(json.hooks ?? {})) {
      for (const group of groups) {
        for (const hook of group.hooks ?? []) {
          for (const m of (hook.command ?? '').matchAll(/\$\{?CLAUDE_PROJECT_DIR\}?"?\/([^\s"']+)/g)) {
            const script = m[1];
            const abs = join(root, script);
            if (!existsSync(abs)) {
              add('error', settings, 'hook', `${event} hook runs \`${script}\`, which does not exist`);
            } else if (!/^\s*node\s/.test(hook.command) && !(statSync(abs).mode & 0o111)) {
              add('error', settings, 'hook', `${event} hook \`${script}\` is not executable (chmod +x)`);
            }
          }
        }
      }
    }
  }

  // --- script, agent and skill references -------------------------------
  const pkgScripts = (dir) => {
    const p = join(root, dir, 'package.json');
    return existsSync(p) ? Object.keys(JSON.parse(readFileSync(p, 'utf8')).scripts ?? {}) : null;
  };
  const workspaces = new Map();
  for (const group of ['apps', 'packages']) {
    for (const d of ls(group)) {
      const p = join(root, group, d, 'package.json');
      if (existsSync(p)) {
        workspaces.set(JSON.parse(readFileSync(p, 'utf8')).name, `${group}/${d}`);
      }
    }
  }
  const rootScripts = pkgScripts('.') ?? [];
  for (const [file, text] of texts) {
    for (const ref of scriptReferences(codeText(text))) {
      const dir = ref.dir ?? (ref.filter ? workspaces.get(ref.filter) : '.');
      if (!dir) {
        continue; // filter by glob or unknown package: not checkable
      }
      const scripts = pkgScripts(dir);
      if (
        scripts &&
        !scripts.includes(ref.name) &&
        !(dir === '.' && ref.name === 'test' && rootScripts.includes('test'))
      ) {
        add(
          'error',
          file,
          'script',
          `\`${ref.name}\` is not a script in ${dir === '.' ? 'the root package.json' : `${dir}/package.json`}`
        );
      }
    }
    if (file === 'CLAUDE.md') {
      continue;
    }
    for (const m of text.matchAll(AGENT_SUFFIX)) {
      if (!agents.includes(m[1]) && !EXTERNAL_SKILLS.has(m[1])) {
        add('error', file, 'agent-ref', `names agent \`${m[1]}\`, which does not exist in .claude/agents/`);
      }
    }
    for (const m of text.matchAll(/`([a-z][a-z0-9-]+)` skill|\bthe ([a-z][a-z0-9]*(?:-[a-z0-9]+)+) skill\b/g)) {
      const name = m[1] ?? m[2];
      if (!skills.includes(name) && !EXTERNAL_SKILLS.has(name)) {
        add('error', file, 'skill-ref', `names skill \`${name}\`, which does not exist in .claude/skills/`);
      }
    }
    for (const { re, now } of STALE_NAMES) {
      const line = text.split('\n').findIndex((l) => re.test(l));
      if (line >= 0) {
        add('warn', `${file}:${line + 1}`, 'stale-name', `uses the old product name; say ${now}`);
      }
    }
  }
  return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const findings = auditHarness(root);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(findings, null, 2));
  } else {
    for (const f of findings) {
      console.log(`${f.severity === 'error' ? 'ERROR' : 'WARN '} ${f.file}  [${f.kind}] ${f.message}`);
    }
    const errors = findings.filter((f) => f.severity === 'error').length;
    console.log(`\n${basename(root)} harness: ${errors} errors · ${findings.length - errors} warnings`);
  }
  process.exit(findings.some((f) => f.severity === 'error') ? 1 : 0);
}
