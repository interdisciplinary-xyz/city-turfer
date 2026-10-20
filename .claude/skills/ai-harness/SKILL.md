---
name: ai-harness
description:
  How CityTurfer's Claude Code harness is built and kept honest — CLAUDE.md, skills, agents,
  commands, the guard hooks (.claude/hooks + tools/harness/hook-rules.mjs), permissions in
  .claude/settings.json, and the audits (pnpm run audit:harness, audit:docs). Covers where a new
  rule belongs (hook vs lint vs skill vs CLAUDE.md), how to write a skill or agent that triggers
  well, and how to test a hook. Use when adding or changing a skill, agent, command, hook or
  permission, when a hook blocks something it should not (or misses something), when audit:harness
  fails, or when the user asks to improve the AI setup.
---

# The AI harness

## Map

| Piece                            | Job                                                           |
| -------------------------------- | ------------------------------------------------------------- |
| `CLAUDE.md`                      | Always-loaded facts: stack, layout, hard rules, commands      |
| `.claude/skills/<name>/SKILL.md` | Know-how loaded on demand, chosen by its `description`        |
| `.claude/agents/<name>.md`       | Specialists with their own context, tools and model           |
| `.claude/commands/<name>.md`     | Slash commands (`/audit-docs`); prefer skills for new ones    |
| `.claude/settings.json`          | Permissions (allow/deny) and hook wiring, shared via git      |
| `.claude/hooks/*.mjs`            | Thin I/O wrappers around `tools/harness/hook-rules.mjs`       |
| `tools/harness/hook-rules.mjs`   | Pure rules, tested in `tools/__tests__/hook-rules.test.mjs`   |
| `tools/harness-audit.mjs`        | `pnpm run audit:harness`: harness wired to the code?          |
| `tools/docs-audit.mjs`           | `pnpm run audit:docs`: dead paths/links in `.claude/*.md` too |
| `.claude/settings.local.json`    | Personal, git-ignored overrides                               |

### Hooks today

- **SessionStart** `session-start.mjs`: branch, active scope, PR base and title, dirty tree.
- **PreToolUse Edit|Write|MultiEdit** `pre-edit.mjs` (deny): `CHANGELOG.md`; secret files (rules
  from `tools/check-secret-files.mjs`); the generated native folders (apps/mobile/ios and android,
  git-ignored); DDD dependency rule on imports the edit adds (mirror of
  `apps/mobile/.dependency-cruiser.cjs`).
- **PreToolUse Bash** `pre-bash.mjs`: deny push to main, force-push to scope/release, `git tag`,
  `git commit --no-verify`, wrong PR title/base, squash merges; ask for `gh pr merge`,
  `git reset --hard`, copying data off a physical iPhone.
- **PostToolUse Edit|Write|MultiEdit** `format-ts.sh` (Prettier) and `post-edit.mjs`: block-feedback
  for `audit:logs` privacy findings and newly hard-coded brand hex; once-per-session reminders for
  turf/geo parity, runtime fingerprint, migrations, background task, Health privacy.

## Where does a new rule go?

1. **Can a machine check it, and is breaking it expensive?** → a check in the gate (ESLint,
   dependency-cruiser, a `tools/*.mjs` audit in `ci:quality`). That is the real enforcement.
2. **Is it cheap to catch at edit time and costly to discover in CI?** → also a hook rule, so Claude
   gets feedback immediately. Mirror the gate; never invent a rule that only the hook knows.
3. **Is it judgement or know-how** (how to tune turf, how to test background GPS)? → a skill.
4. **Must every session know it?** → one line in `CLAUDE.md`, with details in a skill or doc.
5. **Needs its own context window or tool limits** (review, planning, a big area)? → an agent.

Prefer `ask` over `deny` when the action is sometimes right (merges, resets). Use `deny` only for
what the process forbids outright.

## Writing skills and agents

- `name` = folder (skill) or file name (agent). `description` is the trigger: say what it covers
  **and** when to use it, with the user's likely words ("tracking stops when screen is off"). Max
  1024 characters.
- Body: the decisions and the commands, not a tutorial. Point to files with repo-root paths in
  backticks (audit:docs checks they exist). Name other skills as "the `x` skill" and agents by name
  (audit:harness checks they exist).
- Agents: `tools:` least privilege (reviewers and planners get no Write/Edit); `model: opus` for
  judgement-heavy work, `sonnet` for well-specified building.
- Add the name to the matching bullet in `CLAUDE.md` → "Claude Code setup".

## Changing a hook rule

1. Edit `tools/harness/hook-rules.mjs` (pure) — or the wrapper in `.claude/hooks/` only for I/O.
2. Add cases to `tools/__tests__/hook-rules.test.mjs`, including a false-positive case.
3. `node --test tools/__tests__/hook-rules.test.mjs`
4. Replay against the codebase when the rule reads code (zero findings expected on clean code):
   every tracked `apps/mobile/src` file through `dependencyFindings(file, '', content)`.
5. Live check in a session: attempt the forbidden edit/command (use `--dry-run` for git) and confirm
   the message.

Hooks fail open on their own crashes (non-zero exit without JSON is a non-blocking error), so a
broken hook shows up as a warning, not a wall. The gate in CI still catches everything.

## Keep it healthy

```bash
pnpm run audit:harness     # frontmatter, CLAUDE.md lists, hook scripts, scripts/agents/skills named
pnpm run audit:docs        # dead paths and links, incl. .claude/*.md
node --test tools/__tests__/hook-rules.test.mjs tools/__tests__/harness-audit.test.mjs
```

Both run in `pnpm run ci:quality` (audit:harness) or on demand (`/audit-docs`). When the code moves
(a renamed folder, a new context, a new script), update the skill that describes it in the same PR.
