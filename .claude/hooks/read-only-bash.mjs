#!/usr/bin/env node
// PreToolUse (Bash), wired in the frontmatter of read-only agents (mobile-reviewer, rn-architect):
// deny any command that could write a file, change git state or run arbitrary code.
import { readFileSync } from 'node:fs';

import { readOnlyBashFindings } from '../../tools/harness/hook-rules.mjs';

const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
const findings = readOnlyBashFindings(payload.tool_input?.command ?? '');
if (findings.length) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `.claude/hooks/read-only-bash.mjs:\n${findings.map((f) => `[${f.rule}] ${f.message}`).join('\n')}`,
      },
    })
  );
}
