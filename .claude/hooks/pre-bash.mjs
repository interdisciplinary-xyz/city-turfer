#!/usr/bin/env node
// PreToolUse (Bash): enforce the branch/release policy (docs/process/release-manager.md) and the
// device-data rule. deny = Claude must change course; ask = the user confirms in the prompt.
import { readFileSync } from 'node:fs';

import { gitContext } from '../../tools/harness/git-context.mjs';
import { bashFindings } from '../../tools/harness/hook-rules.mjs';

const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
const command = payload.tool_input?.command ?? '';
if (!/\b(git|gh|xcrun|idevice\w*)\b/.test(command)) {
  process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? process.cwd();
const findings = bashFindings(command, gitContext(root));
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
