#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): fast checks on the file Claude just changed.
//   block  (fed back to Claude to fix): unguarded console / coordinates in diagnostics (audit:logs),
//          newly hard-coded brand colours
//   context (once per session per topic): parity and fingerprint reminders
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { auditSource } from '../../tools/audit-logs.mjs';
import { brandHexFindings, remindersFor } from '../../tools/harness/hook-rules.mjs';

const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
const root = process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? process.cwd();
const file = payload.tool_input?.file_path;
if (!file || !existsSync(file)) {
  process.exit(0);
}
const rel = relative(root, resolve(root, file)).split('\\').join('/');
if (rel.startsWith('..') || rel.startsWith('.claude/worktrees/')) {
  process.exit(0);
}
const isSource = /\.(ts|tsx)$/.test(rel) && !/(__tests__|test-support)\/|\.test\.tsx?$/.test(rel);
const problems = [];

// 1. Privacy: same rules as `pnpm run audit:logs`, on the edited file only.
if (isSource && rel.startsWith('apps/mobile/src/')) {
  for (const f of auditSource(readFileSync(file, 'utf8'))) {
    problems.push(`${rel}:${f.line} [audit:logs/${f.rule}] ${f.message}`);
  }
}

// 2. Brand colours newly hard-coded in an app.
if (isSource && /^apps\/(mobile|web)\/src\//.test(rel)) {
  const brandSrc = ['colors.ts', 'tokens.ts']
    .map((f) => join(root, 'packages/brand/src', f))
    .filter(existsSync)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const brand = new Set((brandSrc.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toUpperCase()));
  const input = payload.tool_input;
  let before;
  let after;
  if (payload.tool_name === 'Write') {
    try {
      before = execFileSync('git', ['show', `HEAD:${rel}`], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      before = '';
    }
    after = input.content ?? '';
  } else {
    const edits = payload.tool_name === 'MultiEdit' ? (input.edits ?? []) : [input];
    before = edits.map((e) => e.old_string ?? '').join('\n');
    after = edits.map((e) => e.new_string ?? '').join('\n');
  }
  for (const f of brandHexFindings(rel, before, after, brand)) {
    problems.push(`${rel} [${f.rule}] ${f.message}`);
  }
}

// 3. Reminders, once per session per topic.
const seenFile = join(tmpdir(), 'cityturfer-claude-hooks', `${payload.session_id ?? 'none'}.json`);
let seen = [];
try {
  seen = JSON.parse(readFileSync(seenFile, 'utf8'));
} catch {
  // first reminder of the session
}
const fresh = remindersFor(rel).filter((r) => !seen.includes(r.id));
if (fresh.length) {
  try {
    mkdirSync(join(tmpdir(), 'cityturfer-claude-hooks'), { recursive: true });
    writeFileSync(seenFile, JSON.stringify([...seen, ...fresh.map((r) => r.id)]));
  } catch {
    // reminders may repeat; harmless
  }
}

const out = {};
if (problems.length) {
  out.decision = 'block';
  out.reason = `Fix before moving on (.claude/hooks/post-edit.mjs):\n${problems.join('\n')}`;
}
if (fresh.length) {
  out.hookSpecificOutput = {
    hookEventName: 'PostToolUse',
    additionalContext: fresh.map((r) => `Reminder (${r.id}): ${r.message}`).join('\n'),
  };
}
if (Object.keys(out).length) {
  process.stdout.write(JSON.stringify(out));
}
