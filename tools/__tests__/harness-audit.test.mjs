import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { auditHarness, codeText, listedNames, scriptReferences, yamlFrontmatter } from '../harness-audit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'harness-audit-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const agent = (name, extra = '', body = '## Report\n\nChanged · Verified · Not verified.') =>
  `---\nname: ${name}\ndescription: Does ${name} things.\ntools: Read, Grep\nmodel: sonnet\n${extra}---\n\n${body}\n`;
const skill = (name, body = '') => `---\nname: ${name}\ndescription: How to ${name}.\n---\n\n${body}\n`;
const CLAUDE_MD = (skills, agents) =>
  `# X\n\n## Claude Code setup\n\n- Skills (\`.claude/skills/\`): ${skills.map((s) => `\`${s}\``).join(', ')}.\n- Agents (\`.claude/agents/\`): ${agents.map((s) => `\`${s}\``).join(', ')}.\n\n## Docs\n`;
const PKG = JSON.stringify({ scripts: { test: 'x', 'audit:docs': 'x' } });

test('the real harness passes', () => {
  const errors = auditHarness(ROOT).filter((f) => f.severity === 'error');
  assert.deepEqual(errors, []);
});

test('a consistent fixture passes', () => {
  const dir = fixture({
    'package.json': PKG,
    'CLAUDE.md': CLAUDE_MD(['ship'], ['web-engineer']),
    '.claude/skills/ship/SKILL.md': skill('ship', 'Run `pnpm run audit:docs`, then ask the `web-engineer`.'),
    '.claude/agents/web-engineer.md': agent('web-engineer'),
  });
  assert.deepEqual(auditHarness(dir), []);
});

test('reports frontmatter, list, script, reference and hook drift', () => {
  const dir = fixture({
    'package.json': PKG,
    'CLAUDE.md': CLAUDE_MD(['ship', 'gone'], ['web-engineer']),
    '.claude/skills/ship/SKILL.md': skill(
      'shipping',
      'Run `pnpm run lint:all`. Use the `missing-skill` skill and the data-engineer. TurfTrack.'
    ),
    '.claude/skills/extra/SKILL.md': skill('extra'),
    '.claude/agents/web-engineer.md': agent('web-engineer')
      .replace('Read, Grep', 'Read, Teleport')
      .replace('sonnet', 'gpt-5'),
    '.claude/hooks/check.sh': '#!/bin/sh\n',
    '.claude/settings.json': JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/check.sh' }] },
        ],
        Stop: [{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/missing.mjs' }] }],
      },
    }),
  });
  const kinds = auditHarness(dir).map((f) => `${f.severity}:${f.kind}:${f.message}`);
  const has = (re) =>
    assert.ok(
      kinds.some((k) => re.test(k)),
      `${re} in\n${kinds.join('\n')}`
    );
  has(/error:frontmatter:name `shipping` ≠ folder name `ship`/);
  has(/error:frontmatter:unknown tool `Teleport`/);
  has(/error:frontmatter:unknown model `gpt-5`/);
  has(/error:setup-list:skills `extra` exists but is not listed/);
  has(/error:setup-list:skills `gone` is listed but does not exist/);
  has(/error:script:`lint:all`/);
  has(/error:skill-ref:.*`missing-skill`/);
  has(/error:agent-ref:.*`data-engineer`/);
  has(/error:hook:.*check\.sh` is not executable/);
  has(/error:hook:.*missing\.mjs`, which does not exist/);
  has(/warn:stale-name/);

  chmodSync(join(dir, '.claude/hooks/check.sh'), 0o755);
  assert.ok(!auditHarness(dir).some((f) => /not executable/.test(f.message)));
});

test('script references come from code only, and skip pnpm built-ins', () => {
  const md =
    'pnpm with hoisting is prose.\n\n```bash\npnpm run build # pnpm nests\npnpm exec tsc\npnpm -C apps/mobile run ios\npnpm --filter @cityturfer/storybook dev\n```\n\nThen `pnpm test`.';
  assert.deepEqual(
    scriptReferences(codeText(md)).map((r) => [r.name, r.dir, r.filter]),
    [
      ['build', null, null],
      ['ios', 'apps/mobile', null],
      ['dev', null, '@cityturfer/storybook'],
      ['test', null, null],
    ]
  );
});

test('reads the names in a CLAUDE.md setup bullet', () => {
  const md =
    '- Skills (`.claude/skills/`): `a`, `b-c`,\n  `d`.\n- Agents (`.claude/agents/`): `x` (Apple Health), `y`.\n- Commands (`.claude/commands/`): `audit-docs` (`/audit-docs`).\n';
  assert.deepEqual(listedNames(md, 'Skills'), ['a', 'b-c', 'd']);
  assert.deepEqual(listedNames(md, 'Agents'), ['x', 'y']);
  assert.deepEqual(listedNames(md, 'Commands'), ['audit-docs', 'audit-docs']);
  assert.equal(listedNames(md, 'Hooks'), null);
});

test('frontmatter must be real YAML: a plain description with ": " is dropped by Claude Code', () => {
  const broken =
    '---\nname: web-engineer\ndescription:\n  Builds and reviews the server\n  side: apps/api and more.\ntools: Read\n---\n\nBody.\n';
  const nested = '---\nname: web-engineer\ndescription:\n  Builds the server side: apps/api.\n---\n\nBody.\n';
  const oneLine = '---\nname: web-engineer\ndescription: Builds the server side: apps/api.\n---\n\nBody.\n';
  const folded =
    '---\nname: web-engineer\ndescription: >-\n  Builds the server side: apps/api and more.\ntools: Read\n---\n\n## Report\n\nNot verified.\n';
  assert.match(yamlFrontmatter(broken).error, /./);
  assert.match(yamlFrontmatter(oneLine).error, /./);
  assert.equal(yamlFrontmatter(folded).data.description, 'Builds the server side: apps/api and more.');
  assert.equal(yamlFrontmatter('no frontmatter'), null);
  // valid YAML, but the description became a mapping
  assert.equal(typeof yamlFrontmatter(nested).data.description, 'object');

  const dir = fixture({
    'package.json': PKG,
    'CLAUDE.md': CLAUDE_MD([], ['web-engineer']),
    '.claude/agents/web-engineer.md': broken,
  });
  const findings = auditHarness(dir);
  assert.ok(
    findings.some((f) => f.severity === 'error' && f.kind === 'frontmatter' && /invalid YAML/.test(f.message)),
    JSON.stringify(findings)
  );

  // false positive: the same text as a folded scalar passes
  const ok = fixture({
    'package.json': PKG,
    'CLAUDE.md': CLAUDE_MD([], ['web-engineer']),
    '.claude/agents/web-engineer.md': folded,
  });
  assert.deepEqual(auditHarness(ok), []);

  const asMapping = fixture({
    'package.json': PKG,
    'CLAUDE.md': CLAUDE_MD([], ['web-engineer']),
    '.claude/agents/web-engineer.md': nested,
  });
  assert.ok(auditHarness(asMapping).some((f) => /description is not a string/.test(f.message)));
});

test('warns about descriptions over 300 characters, errors over 1024', () => {
  const long = (n) => `---\nname: s\ndescription: >-\n  ${'x'.repeat(n)}\n---\n\nBody.\n`;
  const at = (n) =>
    auditHarness(
      fixture({ 'package.json': PKG, 'CLAUDE.md': CLAUDE_MD(['s'], []), '.claude/skills/s/SKILL.md': long(n) })
    ).map((f) => `${f.severity}:${f.kind}`);
  assert.deepEqual(at(300), []);
  assert.deepEqual(at(301), ['warn:frontmatter']);
  assert.deepEqual(at(1025), ['error:frontmatter']);
});

test('a nested .claude/ folder inside .claude/ is an error; worktrees are skipped', () => {
  const dir = fixture({
    'package.json': PKG,
    'CLAUDE.md': CLAUDE_MD([], ['web-engineer']),
    '.claude/agents/web-engineer.md': agent('web-engineer'),
    '.claude/agents/.claude/agent-memory/pm/MEMORY.md': 'x',
    '.claude/worktrees/agent-1/.claude/agents/x.md': 'x',
  });
  const stray = auditHarness(dir).filter((f) => f.kind === 'stray-claude-dir');
  assert.deepEqual(
    stray.map((f) => f.file),
    ['.claude/agents/.claude']
  );
});

test('agent tools: allowlist required, Agent(x) targets exist, read-only is enforced', () => {
  const base = { 'package.json': PKG, 'CLAUDE.md': CLAUDE_MD([], ['a-engineer', 'b-reviewer']) };
  const raw = (name, fm) => `---\nname: ${name}\n${fm}---\n\n## Report\n\nNot verified.\n`;
  const kinds = (files) =>
    auditHarness(fixture({ ...base, ...files })).map((f) => `${f.severity}:${f.kind}:${f.message.slice(0, 40)}`);

  const noTools = kinds({
    '.claude/agents/a-engineer.md': raw('a-engineer', 'description: x\n'),
    '.claude/agents/b-reviewer.md': agent('b-reviewer'),
  });
  assert.ok(
    noTools.some((k) => k.startsWith('error:tools:no `tools:`')),
    noTools.join('\n')
  );

  const spawn = kinds({
    '.claude/agents/a-engineer.md': raw(
      'a-engineer',
      'description: x\ntools: Read, Agent(b-reviewer, ghost-engineer)\n'
    ),
    '.claude/agents/b-reviewer.md': agent('b-reviewer'),
  });
  assert.deepEqual(
    spawn.filter((k) => k.includes('tools')),
    ['error:tools:`Agent(ghost-engineer)` names an agent t']
  );

  const readOnly = kinds({
    '.claude/agents/a-engineer.md': agent('a-engineer'),
    '.claude/agents/b-reviewer.md': raw(
      'b-reviewer',
      'description: Reviews diffs. Read-only.\ntools: Read, Edit, Bash\nmemory: project\n'
    ),
  });
  assert.equal(readOnly.filter((k) => k.startsWith('error:tools:read-only')).length, 3, readOnly.join('\n'));

  const guarded = kinds({
    '.claude/agents/a-engineer.md': agent('a-engineer'),
    '.claude/hooks/read-only-bash.mjs': '',
    '.claude/agents/b-reviewer.md': raw(
      'b-reviewer',
      'description: Reviews diffs. Read-only.\ntools: Read, Bash\nhooks:\n  PreToolUse:\n    - matcher: Bash\n      hooks:\n        - type: command\n          command: node "$CLAUDE_PROJECT_DIR"/.claude/hooks/read-only-bash.mjs\n'
    ),
  });
  assert.deepEqual(guarded, []);

  const allowlistHook =
    'hooks:\n  PreToolUse:\n    - matcher: Edit|Write\n      hooks:\n        - type: command\n          command: node "$CLAUDE_PROJECT_DIR"/.claude/hooks/edit-allowlist.mjs --allow docs/product/\n';
  const bashHook =
    '    - matcher: Bash\n      hooks:\n        - type: command\n          command: node "$CLAUDE_PROJECT_DIR"/.claude/hooks/read-only-bash.mjs --allow docs/product/\n';
  const hooks = { '.claude/hooks/edit-allowlist.mjs': '', '.claude/hooks/read-only-bash.mjs': '' };
  const scopedOpen = kinds({
    ...hooks,
    '.claude/agents/a-engineer.md': agent('a-engineer'),
    '.claude/agents/b-reviewer.md': raw(
      'b-reviewer',
      `description: Owns docs.\ntools: Read, Edit, Bash\n${allowlistHook}`
    ),
  });
  assert.deepEqual(scopedOpen, ['error:tools:agent with an edit allowlist has Bash wi'], scopedOpen.join('\n'));
  const scopedGuarded = kinds({
    ...hooks,
    '.claude/agents/a-engineer.md': agent('a-engineer'),
    '.claude/agents/b-reviewer.md': raw(
      'b-reviewer',
      `description: Owns docs.\ntools: Read, Edit, Bash\n${allowlistHook}${bashHook}`
    ),
  });
  assert.deepEqual(scopedGuarded, []);
  const scopedNoBash = kinds({
    ...hooks,
    '.claude/agents/a-engineer.md': agent('a-engineer'),
    '.claude/agents/b-reviewer.md': raw('b-reviewer', `description: Owns docs.\ntools: Read, Edit\n${allowlistHook}`),
  });
  assert.deepEqual(scopedNoBash, []);
});

test('agent frontmatter typos and a missing Not verified report are warnings', () => {
  const found = auditHarness(
    fixture({
      'package.json': PKG,
      'CLAUDE.md': CLAUDE_MD([], ['a-engineer']),
      '.claude/agents/a-engineer.md': agent('a-engineer', 'disallowedTool: Write\n', '## Report\n\nFiles changed.'),
    })
  ).map((f) => `${f.severity}:${f.kind}`);
  assert.deepEqual(found.sort(), ['warn:frontmatter', 'warn:report']);
});
