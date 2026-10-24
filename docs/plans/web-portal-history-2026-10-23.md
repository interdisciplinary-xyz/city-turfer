---
status: canonical
verified: 2026-10-24
owner: founder
scope:
  - 'apps/web/src/app/[locale]/account'
  - 'apps/web/src/api'
  - 'apps/web/messages'
  - 'apps/web/e2e'
  - 'packages/core/src/shared-kernel'
  - 'apps/mobile/src/ui-kit/format.ts'
  - 'apps/storybook/src/stories/portal'
  - '.claude/skills/web-portal'
  - '.claude/agents/portal-engineer.md'
summary:
  Plan for the web portal's activity history (v0.11.0) — a list of the backed-up walks, runs and
  rides with totals and a type filter, and a detail page with stats, splits and the route shape;
  read-only, no map tiles, numbers from core's formatters shared with the app
---

# Web portal: activity history

Planned on 2026-10-23 by the main session at the founder's request ("let the web portal show the
history of recorded walks, runs and rides"). It schedules the activities half of what decision D2 of
`docs/decisions/web-portal-2026-10-22.md` left for later. The Turf Map on the web stays later.

## The job

A signed-in user opens the website and sees **every activity their phone backed up**: when, what
kind, how far, how long, how fast, and the shape of the route. It answers "what did I do this
month?" on a big screen and makes the backup visible ("it's really there"). It never replaces the
phone: the list is the backed-up copy and says so.

## What the user sees

| Page                                       | Shows                                                                                                                                                                                                           | Actions                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Activities `/[locale]/account/activities`  | All-time totals (count, distance, moving time) for all and per type; a list by month, newest first: name, day and time, walk / run / ride, distance, moving time, pace or speed, Apple Health mark, route shape | Filter all / walk / run / ride; show more; open one |
| Activity `/[locale]/account/activity?id=…` | Name, type, when (in the activity's own time zone), distance (street estimate noted), moving and elapsed time, pace or speed, elevation gain, kilometre splits, the route shape with GPS-gap estimates dashed   | Back to the list                                    |

Navigation: the portal header gets two links, **Activities** and **Privacy & data**. `/account`
stays Privacy & data (sign-in lands there, as today).

**Empty states** (wording by brand-designer, from the plan's directions):

- backup never turned on: the activities live on the phone; nothing is backed up yet;
- backup withdrawn: the copy here was erased, everything is still on the phone;
- backup on, nothing uploaded yet: the first upload hasn't arrived;
- a filter with no match: no rides backed up (for example);
- Apple Health not shared: a lasting line that Apple Health workouts stay on the phone;
- an activity id that isn't there (deleted on the phone, or not this user's): "not found";
- API unreachable: the portal's existing Unreachable block, with retry.

## Decisions (H1–H6)

| #   | Decision      | Outcome                                                                                                                                                                                                                                                       |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Route drawing | **Inline SVG of the route shape, no basemap.** The list uses the API's `preview`; the detail the full track, simplified with core's `simplify`. No `maplibre-gl` and no tile requests, so D6/D7 (tiles, cells) stay open for the Turf Map                     |
| H2  | Detail URL    | **`/[locale]/account/activity?id=<id>`**: the static export (D1) can't prerender one page per id. The id is an opaque UUID, never a coordinate                                                                                                                |
| H3  | Read-only     | **Yes.** No rename or delete on the web (a web delete would become a tombstone the phone applies; data-flow F2 is still proposed)                                                                                                                             |
| H4  | Numbers       | **Core's formatters.** `fixed`, `formatDistance`, `formatDuration` and `formatPaceOrSpeed` move from `apps/mobile/src/ui-kit/format.ts` into `packages/core/src/shared-kernel/`, taking the locale as an argument; the app wraps them with its current locale |
| H5  | Time zone     | Day and time in the activity's own `timeZone` (as the phone recorded it), the browser's zone when it is null; months group by that local day                                                                                                                  |
| H6  | Paging        | `GET /v1/activities` cursor pages of 50 with "Show more"; the type filter is the API's `type` query, kept in page state (not the URL)                                                                                                                         |

## Contract (no API change)

API contract 0.6.0 already has everything, behind the session cookie (`requireCaller`), no consent
needed for reads:

- `GET /v1/activities?limit&cursor&type&startedAfter&startedBefore` → `ActivityList`
  (`ActivitySummary` with `preview`);
- `GET /v1/activities/{id}` → `ActivityDetail` (splits, `gapRoutes`, bbox);
- `GET /v1/activities/{id}/track` → `Track` (≤ 40,000 points, ETag);
- `GET /v1/activity-totals` → all-time and per-type totals;
- `GET /v1/me/consents` → which empty state applies.

## Work items

| #   | Item                                                                                                                                                         | Owner (skill)                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 1   | Harness: commit the `web-portal` skill and `portal-engineer` agent (brought up to date with Slice 0 as built), owner table row, CLAUDE.md lists              | harness-engineer (ai-harness)           |
| 2   | Formatters into core's shared kernel with tests; the app re-exports and keeps its defaults; outputs unchanged                                                | location-engineer (route-metrics)       |
| 3   | `apps/web` depends on `@cityturfer/core` (shared-kernel only; h3 stays portal-map-only); API calls and hooks for list, detail, track, totals                 | portal-engineer (web-portal)            |
| 4   | Pure helpers with unit tests: month grouping in a time zone, route → SVG path (projection, gap routes, segments)                                             | portal-engineer                         |
| 5   | Pages and components: header nav, Activities, Activity, empty states; `portal.activities.*` copy in en and pl                                                | portal-engineer; wording brand-designer |
| 6   | Stories for the new components; Playwright E2E on the PGlite API (list, filter, show more, detail, not found, empty state, axe, 320 px, no foreign requests) | portal-engineer                         |
| 7   | Review (privacy, boundary, numbers) and QA against the acceptance criteria                                                                                   | mobile-reviewer, qa-engineer            |

## Acceptance

1. A user with N backed-up activities sees N in the list (after "Show more") and the same count as
   all-time totals; filtering to one type shows only that type.
2. Distance, moving time and pace or speed read exactly as the app shows them for the same activity
   and language (same core formatter).
3. The detail shows the splits and the route shape; gap estimates are dashed.
4. Each empty state in "What the user sees" shows its line; an unknown id shows "not found".
5. Portal pages make no request outside the site (no tiles, no fonts, no scripts); `/en` and `/pl`
   are unchanged (no cookie, no API call, no portal chunk).
6. No coordinates or cell ids in URLs, `console` or storage; nothing written to `localStorage`.
7. axe: no serious or critical findings; 320 px without horizontal scroll; keyboard reachable.
8. EN and PL copy reviewed; no banned words (territory, score, points, sync, dashboard…).

## Executed (2026-10-24)

Built on `feat/web-portal-history` (PR #162, into `scope/v0.11.0`): work items 1–6. The Activities
page (totals, type filter, list by month, "Show more") and the Activity page (stats, splits, the
route as an inline SVG with dashed gap estimates, not-found and deleted states), every empty state,
`portal.activities.*` copy in en and pl, core's shared-kernel formatters (H4), stories in
`apps/storybook/src/stories/portal/activity-history.stories.tsx` and the Playwright E2E in
`apps/web/e2e/activities.spec.ts` (with the sign-in round trip to an activity and keyboard reach).
After code review: a 404 or 410 wins over a cached detail, the track is cached per `trackHash`,
cached lists and totals hide when the consents say backup is off, routes across 180° draw as they
are.

Open for the founder:

- English dates read en-GB style (day first, 24-hour) on every portal page (`dateLocale` in
  `_portal/format.ts`); the default until the founder chooses otherwise.
- Acceptance 8: brand-designer's review of the Polish copy is applied (the Polish glossary says
  _terytorium_ now, not turf); the founder's approval of the wording is still open.

## Not in this plan

The Turf Map on the web (cells, tiles: D6, D7), rename or delete on the web, GPX export, share
links, charts or streaks.
