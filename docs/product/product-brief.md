---
status: canonical
verified: 2026-10-20
owner: founder
scope:
  [
    apps/mobile/src/app,
    packages/core/src/contexts/achievements/domain,
    packages/core/src/contexts/territory/domain,
    apps/mobile/app.json,
    apps/web/messages,
    packages/brand/src/copy.ts,
    NOTEBOOK.md,
  ]
summary:
  What CityTurfer is as a product — vision, users, core loop, what a user can do today, what we
  promise vs what's true, success criteria, open questions and known doc drift
---

# CityTurfer — product brief

Canonical for: what the product is, who it's for, what it promises and where it stands. Siblings:
[strategy](strategy.md) (draft), [discovery board](discovery-board.md) (evidence),
[market landscape](market-landscape.md), [launch readiness](launch-readiness.md). Screen-level
detail lives in [features.md](../engineering/features.md); the backlog lives in `NOTEBOOK.md`; how
to use and maintain this brief is in the `product-knowledge` skill
(`.claude/skills/product-knowledge/SKILL.md`). Code wins over this doc.

## 1. In one paragraph

CityTurfer records your walks, runs and rides on a real map and turns every street you cover into
**your turf**: a corridor of hexagonal map cells (about 50 m across) that stays yours for good and
**glows brighter each time you come back**. The Turf Map shows all your tracks and turf on one dark
map, so the streets you live on blaze and the edge of your world is visible at a glance. It is
single-user and local-first: routes stay on the phone.

- Tagline: **"Surf your city. Own your streets."** (alternates and the promo line:
  `packages/brand/src/copy.ts`)
- Differentiator: other trackers show a list of workouts; CityTurfer turns your whole history into
  one glowing picture of your city that only grows.
- Company: Interdisciplinary sp. z o.o. (Poland). Formerly **TurfTrack**; internal ids (bundle
  `com.turftrack.poc`, scheme, DB file name) keep the old name on purpose — renaming breaks installs
  and OTA.

## 2. Who it's for

No persona research exists yet. What the product implies today:

- **City walkers, dog-walkers, commuters on foot or bike** who repeat the same streets and would
  enjoy seeing them glow — the founder's own Warsaw walks and rides are the reference use.
- **Runners and cyclists with an Apple Watch history**: Apple Health import fills the map on day one
  instead of starting from empty.
- **Poland first, then European cities**: Polish company, EN/PL website, the Home City catalogue is
  Polish cities first, then major European ones
  (`packages/core/src/contexts/territory/domain/city-catalog.ts`).
- Users are called **Turfers** in brand copy.

Gap: no explicit personas, jobs-to-be-done or interviews. Worth doing before the App Store step.

## 3. The core loop

```
record a walk / run / ride ──▶ finish ──▶ "Turf gained: +0.12 km² new turf · 340 reinforced"
        ▲                                              │
        │                                              ▼
 come back to a street ◀── achievements, weekly stats ◀── Turf Map glows
 (strength goes up)        Getting started checklist
```

The reward is **coverage** (new cells) and **return** (strength). Nothing decays, so there is never
a reason to feel behind — by design.

## 4. Key ideas in user words

| User sees                          | Means                                                                                                                                                                                      | Source                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Walk · Run · Ride                  | The three activity types (code says `cycle`). Hikes from Apple Health count as walks                                                                                                       | `recording/domain/tracking-profile.ts`                           |
| Turf, cell                         | Every ~50 m hexagon a track passes through (H3 res 11). Permanent; shrinks only when you delete the activity that claimed it                                                               | `packages/core/src/contexts/territory/domain/claim.ts`           |
| Turf gained                        | Per activity: new cells (+area) and reinforced cells (already yours)                                                                                                                       | activity detail                                                  |
| Faint · Glowing · Strong · Blazing | Strength from visits only: `1 − e^(−visits/3)`. One activity = one visit per cell. Roughly 1 visit faint, 2–3 glowing, 4–6 strong, 7+ blazing. "Strong cells" in stats = strong or blazing | `packages/core/src/contexts/territory/domain/strength.ts`        |
| Your city                          | Optional Home City from a bundled list; only decides where maps open. Stored as an id on the phone, no geocoding                                                                           | `docs/decisions/home-city-2026-10-19.md`                         |
| Dashed line, "≈"                   | A GPS gap (> 45 s). Optionally estimated along streets; estimated parts **never** claim turf                                                                                               | `packages/core/src/contexts/activity-log/domain/gap-route.ts`    |
| Achievements                       | <!-- probe:achievements -->20<!-- /probe --> computed live from history (first steps, 5K, night owl, turf lord…). No unlock dates or celebration                                           | `packages/core/src/contexts/achievements/domain/achievements.ts` |
| Getting started                    | Dashboard checklist (record, see turf, try all three types, come back, unlock achievements); hideable                                                                                      | `packages/core/src/contexts/achievements/domain/onboarding.ts`   |

Voice: confident, playful, outdoorsy; never guilt, fake urgency, leaderboards, "score", "points",
"conquer" or "territory" in copy (`brand-system` skill).

## 5. What a user can do today (v0.7.0)

Tabs: **Dashboard · Turf · Record · Stats · Me** (drawer: Profile, Account, City, Info). Full
inventory: [features.md](../engineering/features.md).

- **Record** walk/run/ride with live map and stats, auto-pause, pause/resume, hold-to-finish;
  survives screen lock (iOS native background session) and app kill.
- **See turf** on the always-dark Turf Map: heatmap glow zoomed out, strength-coloured hexagons
  zoomed in, faint tracks coloured by type, type filter, city and fit-all chips.
- **Review**: Dashboard (this week, recent, next achievement, checklist), Stats (8-week chart, turf
  area/cells/strong, all-time per type), History, Activity detail (splits, elevation ≈, turf gained,
  delete).
- **Apple Health (iOS)**: import walks, hikes, runs and rides with routes (whole history, Apple
  Watch included) so they claim turf; save new recordings to Health.
- **Your city**: pick a Home City so maps open there.
- **First run**: sign in → Dashboard empty state → Record asks for location in context → first
  activity → turf appears, checklist and "First steps" tick. No separate intro or permission
  screens.

**In progress (v0.8.0):** a "⬡ Turf" chip on the Record map showing your turf under the live track
(branch `feat/record-turf-overlay`, not yet on scope) — the first step of the "live claiming
overlay" from the PoC plan's M7.

## 6. What we promise vs what's true

| Promise (where)                                | Reality                                                                                                                                                                                                                                                  | Action                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| "Download for Android" (website)               | Sideloaded APK; Android has run on the emulator only, background recording never field-tested on a phone (PoC Q1 open)                                                                                                                                   | Field-test on a real phone, or label the download "preview"              |
| App Store (website)                            | Disabled "Coming soon". iOS runs only on the founder's iPhone via free Apple ID (re-sign every ~7 days); no TestFlight                                                                                                                                   | Developer account decision (`NOTEBOOK.md` RELEASE)                       |
| Accounts (implied)                             | Since #112 (v0.9.0, on scope): sign-in with an emailed code creates an account; admin and demo profiles remain; no way in without an account yet                                                                                                         | Decide whether a way in without an account (decision B1) ships in v0.9.0 |
| EN + PL (website, PL browsers redirected)      | The app speaks English and Polish (Info › Language, v0.10.0); iOS permission prompts and store listings are still English; metric only                                                                                                                   | Native strings and PL store listing with the next binary release         |
| "Your routes stay on your phone." (brand)      | True for storage. Exceptions: map tiles load from OpenFreeMap; optional gap estimation sends gap endpoints (not near start/end) to OSM's router; opt-in Cloud backup (off by default) uploads tracks, and Apple Health imports only with a second switch | Disclosed in-app (Info); add to a privacy policy                         |
| Privacy policy                                 | None, on site or in app. Required before the App Store (HealthKit)                                                                                                                                                                                       | Write one                                                                |
| Store subtitle "Own its streets" (brand skill) | Tagline says "Own your streets"                                                                                                                                                                                                                          | Pick one                                                                 |

## 7. Success criteria

From the PoC plan (`docs/poc-plan.md` §1): **Q1** reliable locked-screen recording on iPhone and
Android · **Q2** accurate distance/time · **Q3** turf feels rewarding (a tester finds their
most-covered street and turf edge without explanation) · **Q4** fast with a year of history on a
mid-range Android · **Q5** clean architecture. Status: iOS Q1 passed on device; Q2/Q5 covered by
tests; Q3 informally; Android Q1 and Q4 unmeasured; the PoC report (M6) is unwritten.

No product metrics exist (activation, retention, waitlist conversion). The Getting started checklist
is the de-facto activation definition; with no analytics by design, measurement would have to come
from tester interviews or an opt-in, coordinate-free signal.

## 8. Non-goals (for now)

From `docs/poc-plan.md` §1 and the architecture decisions: other users' turf, contested turf,
sharing (needs privacy zones first: the map reveals home — risk R8), real accounts, turf decay,
closed loops claiming the area inside, monetization (nothing in the repo), analytics on coordinates.

**Changed on 2026-10-20:** "sync or a backend" and "real accounts" are no longer non-goals. The
v0.8.0 API decision (`docs/decisions/api-2026-10-20.md`) plans an HTTP API on Vercel with Neon
Postgres in Frankfurt, real auth and a mobile sync client that **uploads tracks**. That collides
with the brand line "Your routes stay on your phone." and the local-first positioning — see open
question 8.

## 9. Open product questions

1. What does **100 % city coverage** mean — streets, area, or district first? Blocks the coverage
   gauge (`NOTEBOOK.md`).
2. May **estimated gap routes** claim turf (shown dimmer until really covered)?
3. **Login model** for the App Store: none (local only) vs Sign in with Apple; individual vs
   organisation developer account; final bundle id.
4. **Who is it for first** — walkers, runners or riders? It decides the Record default, the hero and
   the first achievements.
5. Should achievements get **unlock moments** (celebration, dates), and how does that stay "glow,
   never casino"?
6. **Sharing**: a share card for one activity (backlog) needs a privacy stance on start/end points.
7. **Business model**: none yet. Free, one-off, or subscription — and what would be paid?
8. **Sync vs "routes stay on your phone"**: is server sync opt-in (off by default, local-only stays
   a first-class mode), and how do the brand line, privacy policy and store labels change when it
   ships? Decide before phase 5 of the API plan.

## 10. Known doc drift (found 2026-10-20)

- `docs/engineering/features.md` says "on `scope/v0.2.0`" but describes v0.7; omits the Getting
  started checklist; lists Seed demo history as plain Info (it's behind hidden Developer tools: dev
  builds or 5 long-presses on the version); says Apple Health is Simulator-only (import was done on
  the iPhone on 2026-10-19; export on device still unverified).
- `README.md` still says "v0.1.0 released, v0.2.0 in progress".
- `docs/sessions/v0.2.0.md` predates the Dashboard and Me drawer (flagged in its own frontmatter).
- `docs/poc-plan.md` (historical) names three tabs and `cycle`; the app has five tabs and says
  "ride".
- Unused brand copy: tier names and legend title exist in `packages/brand` but the Turf Map has no
  legend.
