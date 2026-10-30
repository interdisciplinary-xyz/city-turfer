---
name: ship-branch
description: >-
  Commit, push and open the PR the CityTurfer way: feat/fix → scope → release → main (small changes
  straight to scope), explicit paths, Conventional Commits, PR title and base, never merge. Use for
  "commit", "push", "open a PR", "ship it", "cut a branch" or "promote to release".
---

# Ship a branch

Policy source: `docs/process/release-manager.md`. The `.claude/hooks/pre-bash.mjs` guard denies the
worst mistakes (push to main, force-push or deleting scope/release, hand-made tags, running the
release locally, `--no-verify` on commit or push, wrong PR title or base); this skill is the path
that never trips it.

## 0. Where am I?

The session-start note names the current branch and the active scope. Otherwise:

```bash
git fetch origin --prune
git branch --show-current
git branch -r --list 'origin/scope/*' --sort=-v:refname | head -1
```

- A **small change** (below) → straight to the active scope (step 1a).
- On `main`, `release/*` or `scope/*` with any other change → cut a branch first (step 1).
- On `feat/<domain>` (or `fix/` `chore/` `test/` `docs/`) → step 2.

## 1a. Small change: commit straight to the active scope

What counts as small, with the **denylist of paths**, is defined once: "Small changes straight to
scope" in `docs/process/release-manager.md`. Read it there before taking this path; a change that
touches a denylisted path takes a branch and a PR. **In doubt, use a branch and a PR.**

```bash
git fetch origin
git switch scope/vX.Y.Z && git pull --ff-only       # or: git switch --detach origin/scope/vX.Y.Z
pnpm run check:secret-files -- --tracked            # the full gate = these two (CI's quality job,
TURBO_FORCE=true pnpm run ci:quality                #   less the admin's Postgres tests)
git add <explicit paths> && git diff --staged --stat
# not copy/messages or docs? run the mobile-reviewer agent on `git diff --staged` first
git commit -m "fix(web): …" -m "Reviewed-by: mobile-reviewer" -m "Co-Authored-By: …"
git push origin HEAD:refs/heads/scope/vX.Y.Z        # never --force (fast-forward only)
gh run list --branch scope/vX.Y.Z --limit 1         # CI runs after the push lands
```

Also run the `verify-change` checks for the touched area. Rejected push:
`git pull --rebase origin scope/vX.Y.Z`, rerun the gate, push again. Report the short SHA (there is
no PR); `docs-engineer` lists direct commits by SHA in the session log and the scope → release PR
body. Never directly on `release/*` or `main` (the guard asks before a push onto `release/*` or an
old scope).

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
  `territory`, `health-sync`, `achievements`, `cloud-backup`, `platform`, `shared-kernel`, `core`,
  `app`, `api`, `brand`, `ui`, `storybook`, `web`, `e2e`, `claude` (the harness), `tooling`,
  `release`, `docs`. One logical change per commit; the CHANGELOG is built from these.

```bash
git commit -m "feat(territory): show turf overlay on the record screen" -m "Why, in one or two lines." -m "Co-Authored-By: …"
```

End the message with the attribution line from the system reminder when one is given.

If a hook fails, fix the cause. Never `--no-verify` a commit (it skips the secret-file guard) or a
push (it skips the pre-push gate).

## 3. Push and open the PR (every branch gets one)

```bash
git push -u origin HEAD
gh pr create --base scope/vX.Y.Z --title "city-turfer - feat/<domain>" --body-file /tmp/pr.md
```

| Head                       | Base             | Notes                                            |
| -------------------------- | ---------------- | ------------------------------------------------ |
| `feat/` `fix/` `chore/` …  | `scope/vX.Y.Z`   | the active scope                                 |
| small change (step 1a)     | `scope/vX.Y.Z`   | direct fast-forward push, no PR; report the SHA  |
| `scope/vX.Y.Z`             | `release/vX.Y.Z` | `--draft`; needs `pnpm run test:e2e` first       |
| `release/vX.Y.Z`           | `main`           | founder merges by hand                           |
| `fix/<slug>` after promote | `release/vX.Y.Z` | then merge release back down into the next scope |
| `hotfix/<slug>`            | `main`           | then back down into release and scope            |

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
- Never tag, never run `pnpm run release` (commit-and-tag-version) and never edit `CHANGELOG.md`:
  `release.yml` does all three on merge to main. The preview is
  `pnpm exec commit-and-tag-version --dry-run [--release-as X.Y.Z]` and nothing else (with pnpm,
  `pnpm run release -- --dry-run` is the real release: the `--` reaches it).

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
