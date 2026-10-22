---
name: ai-harness
description: >-
  How the Claude Code harness works: CLAUDE.md, skills, agents, hooks, settings and the audits;
  where a new rule goes and how to test a hook. Use when changing a skill, agent, hook or
  permission, when a hook blocks wrongly, when audit:harness fails, or to improve the AI setup.
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
  `apps/mobile/.dependency-cruiser.cjs`; `packages/core` has only its gate).
- **PreToolUse Bash** `pre-bash.mjs`: commands are tokenised (quotes, heredocs, `bash -c`, `git -c`,
  wrappers), so text inside a message or body never counts. Deny push to main, force-push or delete
  of main/scope/release (remote or local), `git tag`, `--no-verify` on commit or push, the release
  (`pnpm run release`, `commit-and-tag-version`; `--dry-run` passes), wrong PR title/base on
  `gh pr create` and `gh pr edit` (`--fill` still needs `--title`), squash merges; ask for
  `gh pr merge`, `git reset --hard`, copying data off a physical iPhone.
- **PostToolUse Edit|Write|MultiEdit** `format-ts.sh` (Prettier) and `post-edit.mjs`: block-feedback
  for `audit:logs` privacy findings and newly hard-coded brand hex; once-per-session reminders for
  turf/geo parity (`packages/core` and the app), runtime fingerprint, migrations, background task,
  Health privacy.

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
  **and** when to use it, with the user's likely words ("tracking stops when screen is off"). Aim
  for ≤ 300 characters (audit:harness warns above, errors above 1024): every description is in every
  session's context.
- **The frontmatter must be valid YAML**, or Claude Code silently drops the file (it vanishes from
  the agent or skill list). An unquoted `: ` or ` #` inside a plain value breaks it, so write
  descriptions as a folded block, which Prettier keeps:

  ```yaml
  description: >-
    What it covers: the details. Use when …
  ```

  audit:harness parses every frontmatter with the `yaml` package; after editing, also check the name
  appears in the session's list.

- Body: the decisions and the commands, not a tutorial. Point to files with repo-root paths in
  backticks (audit:docs checks they exist). Name other skills as "the `x` skill" and agents by name
  (audit:harness checks they exist).
- **Agents** (the standard; audit:harness checks the mechanical parts):
  - Only for judgement with its own verification loop, or to keep high-volume output out of the main
    context. Otherwise a gate, hook or skill holds the rule more cheaply.
  - **One owner per path:** the map is the `add-feature` skill's §2 table. The body says "you own X;
    you hand off Y to Z", and Z exists.
  - **`tools:` is an allowlist** (omitted = every tool, an audit error). "Read-only" in the
    description means no Write/Edit, no `memory` (it grants both), and Bash only behind the
    `.claude/hooks/read-only-bash.mjs` hook in the agent's own `hooks:`. An agent that may edit only
    some paths gets `.claude/hooks/edit-allowlist.mjs` (`--allow` / `--ask`). `Agent(a, b)` limits
    which agents it may spawn (main-session agents only).
  - **Model by the cost of a silent mistake**, not the role's seniority: `opus` where an error is
    subtle and surfaces late (tracking, data, maps, privacy, architecture); a cheaper model only
    where output is visible or mechanically checked, recorded as a YAML comment on the `model:` line
    (`model: sonnet # deliberate cost choice: …`).
  - **Body order:** identity and priorities → what you own → Read first (skills and decision records
    by reference, never pasted) → How you work → What good looks like → Non-negotiables (each earned
    from a real failure) → a "don't trust your training data" procedure for its fast-moving
    libraries (version in `package.json` → installed source → versioned docs, cite which) → Before
    you report back (exact commands, plus one "never report works on X alone") → `## Report`.
  - **`## Report`** asks for Changed · Verified · **Not verified** · Decisions taken · Needs a
    human.
  - Never repeat a rule a gate enforces (lint, dependency rules, brand hex, `packages/ui` imports),
    and never make an agent read another agent's file as its rules: shared rules go in a skill.
- Add the name to the matching bullet in `CLAUDE.md` → "Claude Code setup".
- `memory: project` agents keep notes in `.claude/agent-memory/<name>/`, resolved from the session's
  working directory. Launch agents from the repo root: from inside `.claude/` they write a stray
  nested `.claude/agent-memory/` (audit:harness reports any nested `.claude/`).

## Changing a hook rule

1. Edit `tools/harness/hook-rules.mjs` (pure) — or the wrapper in `.claude/hooks/` only for I/O.
2. Add cases to `tools/__tests__/hook-rules.test.mjs`, including a false-positive case.
3. `node --test tools/__tests__/hook-rules.test.mjs`
4. Replay against the codebase when the rule reads code (zero findings expected on clean code):
   every tracked `apps/mobile/src` file through `dependencyFindings(file, '', content)`.
5. Live check in a session: attempt the forbidden edit/command (use `--dry-run` for git) and confirm
   the message.

Hooks fail open on their own crashes (non-zero exit without JSON is a non-blocking error), so a
broken hook shows up as a warning, not a wall. CI (`ci:quality`) still catches code rules (lint,
dependency rules, tests, log audit), but not process rules: a push to main, a tag, a local release
or a squash merge is stopped only by the hook (and GitHub branch protection, where it is set up).
Keep those rules tested.

## Keep it healthy

```bash
pnpm run audit:harness     # frontmatter, CLAUDE.md lists, hook scripts, scripts/agents/skills named
pnpm run audit:docs        # dead paths and links, incl. .claude/*.md
node --test tools/__tests__/hook-rules.test.mjs tools/__tests__/harness-audit.test.mjs
```

Where they run: audit:harness and the tool tests are in `pnpm run ci:quality`, so CI fails on them.
audit:docs is **not** (its findings include judgement calls): run it yourself after touching any
`*.md`, or `/audit-docs` for a full review. It treats git-ignored paths (build outputs such as
`apps/web/out`) as known and skips `.claude/worktrees/`. When the code moves (a renamed folder, a
new context, a new script), update the skill that describes it in the same PR.
