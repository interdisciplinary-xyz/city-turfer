#!/usr/bin/env node
// SessionStart: tell Claude where it stands in the branch flow (stdout becomes session context).
import { readFileSync } from 'node:fs';

import { gitContext } from '../../tools/harness/git-context.mjs';
import { expectedBase } from '../../tools/harness/hook-rules.mjs';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  // no payload: still print what git knows
}
// The folder the session runs in (a worktree when Claude was started in one).
const root = payload.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const { branch, activeScope, dirty } = gitContext(root);
if (!branch) {
  process.exit(0);
}

const lines = [`CityTurfer session: on \`${branch}\`, active integration branch \`${activeScope ?? 'unknown'}\`.`];
const base = expectedBase(branch, activeScope);
if (base) {
  lines.push(`PRs from this branch target \`${base.join('` or `')}\`, titled "city-turfer - ${branch}".`);
} else if (branch === 'main') {
  lines.push('You are on main: cut a feat/<domain> branch from the active scope before changing code.');
}
if (dirty) {
  lines.push(`${dirty} uncommitted path(s) in the working tree: they may be the user's work in progress.`);
}
lines.push(
  'Harness: guard hooks enforce the hard rules on edit and git/gh; verify with the verify-change skill, ship with ship-branch, keep .claude/ healthy with `pnpm run audit:harness`.'
);
process.stdout.write(`${lines.join('\n')}\n`);
