---
status: canonical
verified: 2026-10-23
owner: founder
scope: [docs/sessions, docs/plans, NOTEBOOK.md]
summary:
  How to hand a session off and pick it up again without losing context — the version session log is
  the source of truth
---

# Session migration

How to offload ("hands off") and restore ("hands on") a developer or AI-agent session without losing
context. Adapted from empatalk's `SESSION_MIGRATION.md`; companion to
`docs/process/release-manager.md`.

## 1. Purpose

Keep implementation continuity, release state, debugging context, decisions and tooling knowledge
across a switch of machine, terminal, developer or agent, so the next session resumes instead of
re-learning the repo.

## 2. Where migration state lives

- **Session log** in `docs/sessions/`, one file per version (`vX.Y.Z.md`): what was built, verified,
  found and fixed, the PRs, and **Open / next**. A new working day is a new dated section in the
  same file (v0.1.0's "Day 2 — background tracking fixed (2026-10-16)"). **The newest section of the
  current version's log is the source of truth.**
- **Backlog** `NOTEBOOK.md` (repo root): one block per version, `- [ ] AREA: item` with the commit
  scope as the area. It has blocks only for v0.2.0 and v0.3.0; since v0.4.0 open items live in the
  session logs (in **Open / next** where the log has one) and in the live plans in `docs/plans/`.
- **Milestone scope**: the open `scope/vX.Y.Z → release/vX.Y.Z` PR body on GitHub (#18 for v0.2.0).
- **Cross-session memory**: `~/.claude/projects/<repo>/memory/MEMORY.md` and its files, auto-loaded
  by Claude Code (for example: ask before copying data off the founder's iPhone). Agents with their
  own memory keep it in `.claude/agent-memory/<agent>/`.
- **Canon**: `CLAUDE.md`, `docs/engineering/`, `docs/decisions/` and `docs/INDEX.md`. Long-lived,
  and only as good as their `verified:` date: check against code.

## 3. Offload ("hands off")

Before ending a session or switching machine, terminal, developer or agent:

1. Update the current version's session log. Same day: extend today's section; don't start a second,
   conflicting one.
2. **Verify every claim against code** (file paths, commit ids, PR numbers). Mark anything
   unverified as unverified. "Tests pass" is not "background tracking works" (`CLAUDE.md`).
3. Write down, at minimum:
   - current branch, target branch, PR numbers and their state (open / draft / merged)
   - done this session and not done
   - decisions and why (a big one gets its own record in `docs/decisions/<topic>-YYYY-MM-DD.md`)
   - problems found, fixed or not
   - environment gotchas (Node from `.nvmrc`, Xcode 26.4+, vendored MapLibre, watchman disabled,
     pnpm with `node-linker=hoisted`)
   - device state: installed build, its runtime fingerprint, the latest OTA id, the signing expiry
     date
   - **exact next steps**, ordered, with commands
4. Move open items into the session log's **Open / next** (or the live plan in `docs/plans/` they
   belong to); tick what shipped.
5. Record which gates ran and their result (`pnpm run ci:quality`, `pnpm run test:e2e`,
   `pnpm test:chain`, simulator replay, device) or "not run".
6. Leave committing uncommitted work to the founder: the log says _what_ is uncommitted; it doesn't
   commit it.

## 4. Restore ("hands on")

When starting, onboarding or resuming:

1. Read the newest session log (`ls docs/sessions | sort -V | tail -1`, then its last section and
   **Open / next**), then the live plans in `docs/plans/`, then `CLAUDE.md`. Memory loads on its
   own.
2. Treat the newest session log as the source of truth; where older docs or memory disagree, they
   are stale (the log should say so).
3. Check the repo before trusting the notes:

   ```bash
   git branch --show-current && git status --short
   gh pr list --repo interdisciplinary-xyz/city-turfer
   nvm use && pnpm install --frozen-lockfile
   pnpm run ci:quality
   pnpm run audit:docs
   ```

4. Summarise the current state, risks, blockers and next steps.
5. **Don't start implementing** until asked.

## 5. Checklist

A handoff is complete when the session log answers all of:

- [ ] Branch, target and PR state (numbers, draft or ready)
- [ ] Done vs not done this session
- [ ] Decisions and rationale
- [ ] Problems found, technical debt, blockers
- [ ] Environment and device state (build, fingerprint, OTA id, signing expiry)
- [ ] Ordered next steps with commands
- [ ] Verification status: what ran, what passed, what didn't run

## 6. Anti-patterns

- Describing architecture that isn't in the code.
- Two conflicting logs for the same day.
- Recording only the happy path: blockers and gotchas are the useful part.
- Committing someone's uncommitted work during an offload.
- Trusting a stale doc: check its status in `docs/INDEX.md` first (e.g. `sessions/v0.2.0.md` was ❗
  stale on 2026-10-17).
