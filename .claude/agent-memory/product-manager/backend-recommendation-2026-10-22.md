---
name: backend-recommendation-2026-10-22
description:
  What I recommended on 2026-10-22 for API/back-end scope (backup-first, opt-in, Health excluded in
  phase 1) — check founder outcome before re-recommending
metadata:
  type: project
---

On 2026-10-22 (planning team brief for "a well designed plan for correct API / back-end") I
recommended: first release = opt-in backup & restore for one phone (account + push + full restore),
local-only stays a full mode with no account; second device later; web turf view later; leaderboards
never (principle). Exclude `hk-*` Apple Health activities from phase 1 (Health re-import restores
them; CLAUDE.md hard rule "Health data never sent" conflicts with founder decision D2 in
docs/decisions/api-sync-2026-10-20.md — needs a decision record). Assumption A10 (people want
backup) has zero evidence; proposed a disclosed "Back up your turf" fake door + interview probe in
parallel.

**Why:** strategy guiding policy "never require an account or an upload"; brand PRIVACY_LINE. **How
to apply:** next time, check whether the founder accepted/rejected these and record it here.

**Founder outcome (2026-10-22):** decisions B1–B6 in `docs/plans/backend-plan-2026-10-22.md`.
Accepted: opt-in backup off by default, no-account use stays a full mode (B1). Changed: release 1
also has real accounts, delete, export and rename (B2); Apple Health uploads stay behind their own
opt-in as in v0.8.0 instead of being excluded (B5). Built on `feat/backend-sync` (PR #112).
