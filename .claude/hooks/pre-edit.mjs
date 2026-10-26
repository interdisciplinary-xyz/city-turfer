#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit): deny edits that break a CLAUDE.md hard rule before they land.
// Rules live in tools/harness/hook-rules.mjs (unit-tested); this file only does I/O.
import { existsSync, readFileSync } from 'node:fs';

import { checkoutOf } from '../../tools/harness/git-context.mjs';
import { contentAfter, dependencyFindings, protectedFileFindings } from '../../tools/harness/hook-rules.mjs';

const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
const project = process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? process.cwd();
const file = payload.tool_input?.file_path;
if (!file) {
  process.exit(0);
}
// Repo-relative path in the file's own checkout, so the rules also guard edits in worktrees.
const where = checkoutOf(file, project);
if (!where || where.rel.startsWith('..')) {
  process.exit(0);
}
const { rel } = where;

const before = existsSync(file) ? readFileSync(file, 'utf8') : '';
const after = contentAfter(payload.tool_name, payload.tool_input, before);
const findings = [...protectedFileFindings(rel), ...dependencyFindings(rel, before, after)];

if (findings.length) {
  const reason = findings.map((f) => `[${f.rule}] ${f.message}`).join('\n');
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Blocked by .claude/hooks/pre-edit.mjs:\n${reason}`,
      },
    })
  );
}
