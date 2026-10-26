#!/usr/bin/env node
// PreToolUse (Bash): enforce the branch/release policy (docs/process/release-manager.md), the
// release-tooling rule and the device-data rule. deny = Claude must change course; ask = the user
// confirms in the prompt.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { gitBranch, gitContext } from '../../tools/harness/git-context.mjs';
import { bashFindings } from '../../tools/harness/hook-rules.mjs';

const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
const command = payload.tool_input?.command ?? '';
// Cheap prefilter: only commands that can mention a guarded tool pay for git and parsing.
if (!/\b(git|gh|xcrun|idevice\w*|commit-and-tag-version|release)\b/.test(command)) {
  process.exit(0);
}

// The checkout Claude is in: payload.cwd follows Claude into worktrees and after `cd`, while
// CLAUDE_PROJECT_DIR stays where the session started (https://code.claude.com/docs/en/hooks).
const root = payload.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
// `cd <dir> && git push` and `git -C <dir> push` are judged on that folder's branch.
const findings = bashFindings(command, { ...gitContext(root), cwd: resolve(root), branchAt: gitBranch });
if (findings.length) {
  const decision = findings.some((f) => f.decision === 'deny') ? 'deny' : 'ask';
  const reason = findings
    .filter((f) => f.decision === decision)
    .map((f) => `[${f.rule}] ${f.message}`)
    .join('\n');
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: `.claude/hooks/pre-bash.mjs:\n${reason}`,
      },
    })
  );
}
