---
status: proposed
verified: 2026-10-23
owner: founder
scope:
  [
    packages/core/src/contexts/achievements/domain/achievements.ts,
    apps/mobile/src/app/achievements.tsx,
  ]
summary:
  Achievements list v2 (product owner proposal) — 12 → 20 achievements in five groups; turf and
  coming back weighted as much as distance; weeks counted apart, never in a row; all old ids kept
---

# Achievements list v2 (2026-10-23)

🚧 **Proposed by the product owner, no user evidence yet** (the discovery board's evidence log is
empty). The founder accepts or edits it; the list lives in
`packages/core/src/contexts/achievements/domain/achievements.ts`. Built in #155 and shipped in
v0.10.0; the founder's acceptance is still open.

## Why change it

The v0.2.0 list (12) leaned on fitness numbers: five of twelve were distance goals, and only one
(Stronghold) rewarded coming back, the move the strategy calls core ("reward return as much as
novelty", `docs/product/strategy.md` §2). The ICP's primary Turfer is put off by training by numbers
(`docs/product/icp.md`). The ladders also had big gaps (100 → 1,000 cells, nothing between the first
activity and 3 in one week), and the backlog asked for more tiers.

## The list

Five groups, shown in this order on the Achievements screen with a heading and count each. Turf and
glow come before distance: the map is the reward.

| Group       | Achievement    | Rule                                   | New |
| ----------- | -------------- | -------------------------------------- | --- |
| Firsts      | First steps    | 1 activity                             |     |
|             | All-rounder    | walk, run and ride once each           |     |
|             | Early bird     | start before 7:00                      |     |
|             | Night owl      | start after 22:00                      |     |
| New streets | Neighbourhood  | 100 turf cells                         |     |
|             | District       | 500 turf cells                         | ✔   |
|             | Turf lord      | 1,000 turf cells                       |     |
|             | Across town    | 5,000 turf cells (≈ 11 km²)            | ✔   |
| Coming back | First glow     | 1 strong cell (4 visits)               | ✔   |
|             | Stronghold     | 50 strong cells                        |     |
|             | Home ground    | 250 strong cells                       | ✔   |
| Getting out | Regular        | 3 activities in one calendar week      |     |
|             | Four weeks out | activities in 4 different weeks        | ✔   |
|             | Season ticket  | activities in 12 different weeks       | ✔   |
| Distance    | 5K             | 5 km in one activity                   |     |
|             | 10K            | 10 km in one activity                  | ✔   |
|             | Half marathon  | walk or run 21.0975 km in one activity |     |
|             | Half century   | ride 50 km in one activity             |     |
|             | 100 km club    | 100 km in total                        |     |
|             | 500 km club    | 500 km in total                        | ✔   |

Strong = strength ≥ 0.66 (`isStrong` in the territory domain); with k = 3 that is 4 visits.

## Rules the list keeps

- **Nothing can be lost.** Achievements are computed live from history (nothing stored), so every id
  that shipped stays; ids may be added, never reused. A test pins the v0.2.0 ids.
- **Different weeks, never weeks in a row.** "Four weeks out" and "Season ticket" count distinct
  calendar weeks, so a holiday or an injury costs nothing (regret test, "glow, never casino").
- **Only facts we already have**: activities (type, start, distance), turf cells and strong cells.
  No new data, no migration, no change to the screens' input, nothing leaves the phone.
- **JS only**: ships over the air. New icons are SF Symbols on iOS; Android shows the ★ fallback as
  before.

## Not done (still open)

- Unlock moments and unlock dates (product brief, open question 5): need a stored "seen" state and a
  "glow, never casino" design. A next step, not part of this change.
- A Blazing achievement (cells at the top tier) needs a blazing-cell count from Territory.
- Polish copy: done, translated in #158 (`apps/mobile/messages/pl/achievements.json`); the gendered
  titles are an open copy choice in `docs/decisions/mobile-i18n-2026-10-23.md`.
- Brand-designer review of the new titles and descriptions.
