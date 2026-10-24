---
name: product-knowledge
description: >-
  Use for "what does the app do", "does it really do X", "is this on the roadmap", "what should we
  build next", scoping a version, writing a spec, demo, store listing or tester brief: what
  CityTurfer is, who it's for, and where product truth lives in code and docs.
---

# Product knowledge

The product brief is `docs/product/product-brief.md`. Read it first. This skill tells you how to use
it, where the other sources are, and how to keep them honest.

## Where product truth lives (most to least trustworthy)

| Question                               | Source                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| What does the app do _right now_?      | The code: `apps/mobile/src/app/` (screens), `apps/mobile/src/contexts/*/ui/`   |
| Screen-by-screen inventory             | `docs/engineering/features.md` (check its `verified:` date; see drift below)   |
| Vision, users, loop, promises, gaps    | `docs/product/product-brief.md`                                                |
| Strategy draft, positioning, roadmap   | `docs/product/strategy.md` (proposed until the founder accepts a section)      |
| What we've learned from people         | `docs/product/discovery-board.md` (evidence log, assumptions, interview queue) |
| Competitors, pricing, market facts     | `docs/product/market-landscape.md` (dated snapshot; re-check before quoting)   |
| What blocks a public launch            | `docs/product/launch-readiness.md`                                             |
| What's next, per version               | Newest `scope/v*` branch + `docs/sessions/`; `NOTEBOOK.md` if it has the block |
| What shipped when, and why             | `docs/sessions/` (one log per version), `CHANGELOG.md`, `docs/decisions/`      |
| Vocabulary, PoC questions Q1–Q5, risks | `docs/poc-plan.md` §1, §2, §8 (historical: vocabulary still holds)             |
| Name, taglines, voice, privacy line    | `packages/brand/src/copy.ts`, the `brand-system` skill                         |
| What the website promises              | `apps/web/messages/en.json` and `pl.json`                                      |
| What the OS permission sheets say      | `apps/mobile/app.json` (`infoPlist`, `android.permissions`, plugin strings)    |
| User journeys as tested                | `apps/mobile/e2e/*.yaml` (Maestro flows, ordered in `config.yaml`)             |
| Achievements and onboarding steps      | `packages/core/src/contexts/achievements/domain/`                              |
| Turf strength and tiers                | `packages/core/src/contexts/territory/domain/strength.ts`                      |

**Code wins.** If a doc and the code disagree, the doc is wrong. Say so; don't repeat the doc.

## How to answer a product question

1. Read `docs/product/product-brief.md` for the frame.
2. Check the specific claim in code (table above). A product answer that names a feature should cite
   the screen or use case that implements it.
3. Say what state it's in: **shipped** (on `main`), **on scope** (merged into the open
   `scope/vX.Y.Z`), **in progress** (a feature branch), **planned** (`NOTEBOOK.md`, session log) or
   **not planned** (the brief's non-goals). "The code exists" is not "shipped": check the branch.
4. Say where it's verified: unit tests, Simulator, emulator, or a real device. Background tracking
   and Apple Health only count as working when checked on a device (`mobile-testing` skill).
5. Use the user's words from the brief's vocabulary table: _ride_ (code says `cycle`), _turf_,
   _cell_, _Your city_ (Home City). Never "territory" (English; Polish says _terytorium_, see the
   `mobile-i18n` glossary), "score", "points" or "conquer" in copy.

## Related skills and the owner

- The `product-discovery` skill (learning from people), the `product-strategy` skill (positioning,
  roadmap, pitches, pricing) and the `product-launch` skill (stores, privacy, listings).
- The `product-manager` agent is the Product Owner persona that uses all of them; talk to it
  directly with `claude --agent product-manager`.

## How to scope a version or write a spec

- Start from the newest `scope/vX.Y.Z` branch and its session log in `docs/sessions/`, plus the
  version's block in `NOTEBOOK.md` if there is one (if not, say the backlog lags and propose the
  block to the founder). Name the user-visible outcome first, then the items. One outcome per
  version beats a grab-bag.
- Check each item against the brief's **non-goals** and **open questions**. If an item depends on an
  open question (e.g. "what does 100 % city coverage mean"), the decision comes first; write it as a
  decision record in `docs/decisions/<topic>-YYYY-MM-DD.md`.
- Every spec states: the user and situation, what they see before and after, the copy, empty and
  error states, privacy impact (coordinates and Health data leave the phone only through the opt-in
  cloud backup, `apps/mobile/src/contexts/cloud-backup`; say if the spec changes that), how it is
  verified, and how we'll know it worked.
- Hand the spec to `rn-architect` for the technical plan (the `add-feature` skill), and copy and
  look to `brand-designer`.
- Live specs go in `docs/plans/`, product direction in `docs/product/`, both with docs frontmatter
  (`docs/process/docs-conventions.md`).

## Keeping the brief honest

- After a version ships, update the brief's "Where it stands" section and the timeline, re-check
  every claim you touch against code, and set `verified:` only if you did.
- If you find drift between docs and code, add it to the brief's drift list (or fix the doc if it is
  yours to fix), and run `pnpm run audit:docs`.
- Never type a count that a probe can derive (`docs/process/docs-conventions.md` §4). Write the
  derivation or use a probe.
