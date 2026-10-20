---
status: canonical
verified: 2026-10-20
owner: founder
scope:
  [
    apps/mobile/src/app,
    apps/mobile/src/contexts,
    apps/mobile/src/ui-kit,
    apps/mobile/src/dev,
    apps/mobile/e2e,
  ]
summary:
  Inventory of every shipped feature by tab and screen, where it lives, and the claims that aren't
  true yet
---

# Features

Every feature in the app on `scope/v0.2.0`, grouped by where a person meets it: the five tabs, the
Me drawer, and the screens pushed from them. Format adapted from empatalk's `FEATURES.md`.

> **Derived from code on 2026-10-17.** Where this doc and the code disagree, the code wins. Don't
> hand-edit counts; re-derive them:
>
> | Thing                 | Derive with                                                              |
> | --------------------- | ------------------------------------------------------------------------ |
> | Tabs                  | `apps/mobile/src/app/(tabs)/_layout.tsx` → `Tabs.Screen`                 |
> | Pushed screens        | `apps/mobile/src/app/_layout.tsx` → `Stack.Screen`                       |
> | Me drawer items       | `apps/mobile/src/ui-kit/me-menu.tsx` → `ITEMS`                           |
> | Use cases per context | `apps/mobile/src/contexts/<context>/index.ts` → `create…Api`             |
> | Achievements          | `packages/core/src/contexts/achievements/domain/achievements.ts` → `id:` |
> | Tracking thresholds   | `apps/mobile/src/contexts/recording/domain/tracking-profile.ts`          |
> | Turf strength, tiers  | `packages/core/src/contexts/territory/domain/strength.ts`                |
> | Maestro flows         | `apps/mobile/e2e/config.yaml` → `flowsOrder`                             |
> | SQLite schema         | `apps/mobile/src/platform/migrations.ts`                                 |

Today: <!-- probe:achievements -->12<!-- /probe --> achievements,
<!-- probe:e2e-flows -->13<!-- /probe --> Maestro flows, <!-- probe:migrations -->8<!-- /probe -->

migrations.

## 1. Tabs

Tab bar, left to right: Dashboard · Turf · **Record** (raised centre button) · Stats · Me. The app
opens on Dashboard after sign-in.

### Dashboard (`apps/mobile/src/app/(tabs)/index.tsx`)

- Greeting with the user's name; turf area and "+ this week" under it.
- Live-session banner when a recording is running (taps through to Record).
- "Start recording" button when there are no activities yet.
- This week: distance, moving time, activity count.
- Recent activities with "See all" → History.
- Achievements card (unlocked count, next one within reach) → Achievements.

### Turf (`apps/mobile/src/app/(tabs)/turf.tsx` → `territory/ui/turf-map-view.tsx`)

- The main feature, always dark: every track as a translucent line, turf cells with a heatmap glow
  when zoomed out and strength-coloured cells when zoomed in (`territory/ui/layers.tsx`).
- Walk / run / ride filter (`turf-filter-<type>`); at least one type stays selected.
- Summary card (`turf-summary`): turf area and counts.
- Cells are loaded per viewport (`GetTurfInViewport`); tracks come from activity previews.
- Camera: opens on the **Home City** when one is chosen and flies to a newly chosen one; the
  `turf-city` chip (⌂ city name) recentres on it, a long press opens the picker. Without a Home City
  it fits all tracks once, or follows the Turfer when there are none, and the `turf-pick-city` chip
  ("⌂ Your city") opens the picker. "⤢ All" (`turf-filter-all`) fits all tracks.

### Record (`apps/mobile/src/app/(tabs)/record.tsx` → `recording/ui/record-view.tsx`)

- Type picker: walk, run, ride. Live map following the user, with a recenter button; before the
  first GPS fix it shows the Home City (if one is chosen).
- Before a recording starts, the `record-city` chip at the top ("⌂ Kraków ▾", or "⌂ Your city ▾")
  opens the city picker; a newly chosen city is shown on the map (Recenter returns to the user).
- The "⬡ Turf" chip (`record-turf`, top right; Recenter sits under it) shows or hides the Turfer's
  turf under the live track, before and during a recording. On by default and remembered per user
  (`territory/ui/hooks.ts` `useTurfOverlay`, composed in by the screen).
- Live stats: time, distance, current and average pace (walk, run) or speed (ride).
- Pause / resume; auto-pause from the `TrackingProfile`; **hold to finish**.
- A too-short recording can't be saved: "Too short to save" offers keep recording or discard.
- Background recording with the screen locked (iOS: native background session + expo-location),
  recovery after the app is killed (`RecoverSession`).
- Recording gaps over 45 s start a new segment, drawn dashed.
- On finish, opens the new activity's detail.

### Stats (`apps/mobile/src/app/(tabs)/stats.tsx`)

- This week (distance, time, count) and an 8-week distance chart.
- Turf: area, cells, strong cells.
- All time per type (count, distance, cells) and a total; link to History.

### Me (`apps/mobile/src/ui-kit/me-menu.tsx`)

The Me tab doesn't open a screen: it slides in a drawer from the right with **Profile**,
**Account**, **City** and **Info**. (The `(tabs)/me` route only backs the tab and renders Profile.)

## 2. Screens pushed from the tabs

- **History** (`apps/mobile/src/app/history.tsx`): every activity, from Dashboard "See all" and
  Stats.
- **Activity detail** (`apps/mobile/src/app/activity/[id].tsx` →
  `activity-log/ui/activity-detail-view.tsx`): route map with gap estimates dashed, distance (marked
  "≈" when it includes estimated gaps), moving and elapsed time, average pace or speed, elevation
  "≈", km splits, turf gained (`territory/ui/turf-gained-card.tsx`), delete with confirmation
  (releases its turf). Shows "Saving your activity…" until the outbox has delivered
  `SessionFinished`. Imported workouts say "From Apple Health".
- **Profile** (`apps/mobile/src/app/profile.tsx`): avatar, name, email, totals (activities,
  distance, turf), unlocked achievements → Achievements.
- **Achievements** (`apps/mobile/src/app/achievements.tsx`): every achievement with progress and an
  "n of m unlocked" count; unlocked ones in the strong-tier colour. Evaluated on the fly from
  activity and turf facts (nothing stored).
- **Account** (`apps/mobile/src/app/account.tsx`): email, sign-in method ("Demo account"), sign out
  (blocked with an alert while a recording is in progress).
- **Info** (`apps/mobile/src/app/info.tsx`): app version and OTA update id/channel, "Check for
  updates", a data note, the **Apple Health** card (iOS: connect, import and save switches, last
  import, Import now, Disconnect; `health-sync/ui/apple-health-card.tsx`), the **Cloud backup** card
  (`cloud-backup/ui/cloud-backup-card.tsx`: paste the device token, "Back up to CityTurfer cloud"
  consent switch, "Include Apple Health workouts" on iOS, "Backed up N of M activities · last run
  …", errors in plain words, Back up now, a server URL override for testing), **Seed demo history**
  (90 days around the current location, `apps/mobile/src/dev/demo-history.ts`) and, on iOS, **Add
  sample workouts to Apple Health** (`apps/mobile/src/dev/health-seed.ts`).
- **Your city** (`apps/mobile/src/app/city.tsx` → `territory/ui/city-picker.tsx`): choose the Home
  City from a bundled catalogue (23 Polish, 15 European cities); search ignores accents ("krakow"
  finds Kraków); the current city is ticked; "Clear <city>". Stored per user (`ter_home_city`); its
  id and time go to the server only with Cloud backup on.
- **Sign in** (`apps/mobile/src/app/sign-in.tsx`): the mock account; a wrong password shows
  `sign-in-error`.

## 3. Behind the screens

- **Turf**: claims cells along each recorded segment (H3 res 11), strength from visits only,
  permanent; deleting an activity is the only way turf shrinks.
- **Gap estimates**: street route for recording gaps from the OSM router; distance only, no turf.
- **Data repair job**: `split-track-gaps-v1` re-splits tracks recorded before gap splitting, and
  Territory reclaims from the corrected track.
- **Diagnostics**: `sys_diagnostics` timeline without coordinates, read by
  `apps/mobile/tools/device-diagnose.sh` and `apps/mobile/tools/diagnose-recording.mjs`.
- **OTA**: `expo-updates` checks on load; channel `production`.
- **Apple Health sync** (iOS): imports new walks, hikes, runs and rides with routes whenever the app
  comes to the foreground (full history the first time) and saves each new recording to Health with
  its route. No duplicates: `hs_links` remembers every workout in both directions.
- **Cloud backup** (opt-in, `contexts/cloud-backup`): one-way copy to the CityTurfer API (contract
  `apps/api/openapi.json`). Turning it on records the consent, compares the history with the
  server's manifest and uploads what is missing, oldest first, two at a time; afterwards new
  recordings, deletes, corrected tracks, gap routes and the Home City follow via the outbox. Never
  `demo-*`; `hk-*` only with the Apple Health switch. Network work runs in the foreground only
  (launch, app active, after each outbox run); the outbox handlers just queue (`cb_activities`).

## 4. Known gaps — claims that aren't true yet

- **Apple Health is tested on the Simulator only.** Apple Watch workouts, real permission history
  and large imports need the iPhone (`docs/operations/apple-health.md`).
- **Android has never run on a device.** Both platforms are first-class on paper, but there is no
  Android SDK on the dev Mac; the native background session is iOS-only and Maestro runs on the iOS
  Simulator only (`apps/mobile/e2e/run.sh`).
- **GPX export doesn't exist.** `expo-file-system` and `expo-sharing` are not installed. GPX is read
  only by tests (`apps/mobile/src/test-support/fixtures.ts`).
- **Rename activity has no UI.** `RenameActivity` is in Activity Log's API and `useActivity()`
  returns `rename`, but no screen calls it.
- **Totals stop at 500 activities.** Dashboard, Stats, Profile, Achievements and the Turf map's
  tracks all read `useActivities()` with its default `limit = 500` (`activity-log/ui/hooks.ts`) and
  aggregate in memory. "All time" undercounts past that.
- **The live track is re-read in full** from SQLite after each location batch (`GetLiveTrack` in
  `recording/application/use-cases.ts`), so long recordings get slower to draw.
- **No city coverage.** There is no "% of your city" gauge; what 100 % means is undecided.
- **The PoC report (M6) isn't written** and the Q4 performance budget (a year of history on a
  mid-range Android) is unmeasured.
- **Achievements have no unlock dates or celebration.**
- **Cloud backup is one-way and untested against the real server.** No pull, restore or second
  device; renames are not sent (no `ActivityRenamed` event); bodies are plain JSON (no gzip); the
  server's `trackHash` is not sent; deletes made while backup is off stay on the server. Tests use
  an in-memory server (`cloud-backup/test-support/fake-api-server.ts`); no Maestro flow.
- **Sign-in is a mock.** One account; the app refuses to start with mock auth in a production
  environment.
