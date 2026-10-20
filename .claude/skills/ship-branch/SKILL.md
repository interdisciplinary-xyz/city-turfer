---
name: ship-branch
description:
  Commit, push and open the PR for CityTurfer work following the branch flow (feat/<domain> →
  scope/vX.Y.Z → release/vX.Y.Z → main) — cut the branch from the active scope, stage only your own
  paths, Conventional Commits with the context scopes, PR title "city-turfer - <branch>", the right
  base, the PR template filled with what was actually verified, OTA vs native risk, scope → release
  as draft, never merge. Use when the user says "commit", "push", "open a PR", "ship it", "cut a
  branch", "promote scope to release" or "start the next version".
---

# Ship a branch

Policy source: `docs/process/release-manager.md`. The `.claude/hooks/pre-bash.mjs` guard denies the
worst mistakes (push to main, force-push to scope/release, hand-made tags, `--no-verify`, wrong PR
title or base); this skill is the path that never trips it.

## 0. Where am I?

The session-start note names the current branch and the active scope. Otherwise:

```bash
git fetch origin --prune
git branch --show-current
git branch -r --list 'origin/scope/*' --sort=-v:refname | head -1
```

- On `main`, `release/*` or `scope/*` with code changes → cut a branch first (step 1).
- On `feat/<domain>` (or `fix/` `chore/` `test/` `docs/`) → step 2.

## 1. Cut a branch (from the active scope, never from main)

```bash
git switch -c feat/<domain> origin/scope/vX.Y.Z    # domain = recording, territory, activity-log, …
```

Uncommitted changes come along. If they are the user's unrelated work, ask before moving them.

## 2. Commit

- Gate first: `pnpm run ci:quality` (the pre-push hook only runs types, arch and unit tests). Follow
  the verify-change skill for anything a test can't prove.
- Stage **explicit paths** you changed (`git add <paths>`), never `git add -A` over someone's work
  in progress. `git diff --staged --stat` before committing.
- Conventional Commit, scope = the context or area: `identity`, `recording`, `activity-log`,
  `territory`, `health-sync`, `achievements`, `platform`, `shared-kernel`, `app`, `brand`, `ui`,
  `web`, `e2e`, `tooling`, `release`, `docs`. One logical change per commit; the CHANGELOG is built
  from these.

```bash
git commit -m "feat(territory): show turf overlay on the record screen" -m "Why, in one or two lines." -m "Co-Authored-By: …"
```

End the message with the attribution line from the system reminder when one is given.

If a hook fails, fix the cause. Never `--no-verify` a commit (it skips the secret-file guard).

## 3. Push and open the PR (every branch gets one)

```bash
git push -u origin HEAD
gh pr create --base scope/vX.Y.Z --title "city-turfer - feat/<domain>" --body-file /tmp/pr.md
```

| Head                       | Base             | Notes                                            |
| -------------------------- | ---------------- | ------------------------------------------------ |
| `feat/` `fix/` `chore/` …  | `scope/vX.Y.Z`   | the active scope                                 |
| `scope/vX.Y.Z`             | `release/vX.Y.Z` | `--draft`; needs `pnpm run test:e2e` first       |
| `release/vX.Y.Z`           | `main`           | founder merges by hand                           |
| `fix/<slug>` after promote | `release/vX.Y.Z` | then merge release back down into the next scope |

Body = `.github/pull_request_template.md`, filled honestly:

- **Summary**: what and why, user-visible effect.
- **Test plan**: the commands you actually ran and their result, simulator or device used. Tick a
  box only if you ran it.
- **Risk & rollback**: JS-only (ships as an OTA update) or native (new runtime fingerprint, needs a
  reinstall)? Anything in `apps/mobile/app.json`, `apps/mobile/plugins/`, `apps/mobile/modules/`,
  native dependencies or `packages/ui` dependencies is suspect: compare
  `pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform ios` with the base.
- Release PRs also list the fingerprint they ship.
- End with the PR attribution line from the system reminder when one is given.

## 4. After

- Report the PR URL and CI state (`gh pr checks <n>`).
- **Never merge** (`gh pr merge` asks the user; squash/rebase are denied). Merge commits only.
- Never tag and never edit `CHANGELOG.md`: `release.yml` does both on merge to main.

## Starting the next version (scope cut)

Only when the user asks. After `release/vX.Y.Z` exists:

```bash
git switch -c scope/vX.Y+1.0 origin/release/vX.Y.Z   # or from main after the release merged
# first commit pins package.json versions (root + workspaces) to X.Y+1.0:
git commit -m "chore(release): pin version X.Y+1.0 on scope/vX.Y+1.0"
git push -u origin HEAD
```

Do not bump `apps/mobile/app.json` `version` in a JS-only release (it is part of the runtime
fingerprint).
