#!/usr/bin/env node
// PreToolUse (Bash), wired in an agent's frontmatter.
//   read-only-bash.mjs                       read-only agents (mobile-reviewer, rn-architect): deny
//                                            any command that could write a file, change git state
//                                            or run arbitrary code.
//   read-only-bash.mjs --allow docs/product/ agents with an edit allowlist (product-manager): the
//                                            same, but redirections may write into the --allow
//                                            paths and the agent may branch, commit, push and open
//                                            PRs. Pass the --allow list of its edit-allowlist hook.
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { readOnlyBashFindings } from '../../tools/harness/hook-rules.mjs';

const k = process.argv.indexOf('--allow');
const writable = k > 0 ? (process.argv[k + 1] ?? '').split(',').filter(Boolean) : null;
const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? process.cwd());
const cwd = payload.cwd && isAbsolute(payload.cwd) ? resolve(payload.cwd) : root;
const rel = relative(root, cwd).split('\\').join('/');
const scope = writable ? { writable, root, cwd: rel.startsWith('..') || isAbsolute(rel) ? null : rel } : {};
const findings = readOnlyBashFindings(payload.tool_input?.command ?? '', scope);
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
