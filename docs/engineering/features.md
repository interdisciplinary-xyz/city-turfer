---
status: canonical
verified: 2026-10-23
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
  Inventory of every shipped app feature by tab and screen, where it lives, what the server and web
  portal add, and the claims that aren't true yet
---

# Features

Every feature in the app on `scope/v0.11.0` (the v0.10.0 release), grouped by where a person meets
it: the five tabs, the Me drawer, and the screens pushed from them; then what the server and the web
portal add. Format adapted from empatalk's `FEATURES.md`.

> **Derived from code on 2026-10-23.** Where this doc and the code disagree, the code wins. Don't
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

Today: <!-- probe:achievements -->20<!-- /probe --> achievements,
<!-- probe:e2e-flows -->16<!-- /probe --> Maestro flows,
<!-- probe:migrations -->13<!-- /probe --> migrations.

## 1. Tabs

Tab bar, left to right: Dashboard · Turf · **Record** (raised centre button) · Stats · Me. The app
opens on Dashboard after sign-in.

### Dashboard (`apps/mobile/src/app/(tabs)/index.tsx`)

- Greeting with the name chosen in Me › Account ("Turfer" without one); turf area and "+ this week"
  under it.
- Restore card (below) and the getting-started card: five steps (first walk, see your turf, walk run
  and ride, come back to a street, unlock 3 achievements), hideable
  (`packages/core/src/contexts/achievements/domain/onboarding.ts`).
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
  "≈", km splits, turf gained (`territory/ui/turf-gained-card.tsx`), rename (`rename-activity`; an
  empty name is refused; `activity-log/ui/rename-activity-dialog.tsx`), delete with confirmation
  (releases its turf). Shows "Saving your activity…" until the outbox has delivered
  `SessionFinished`. Imported workouts say "From Apple Health".
- **Profile** (`apps/mobile/src/app/profile.tsx`): avatar, name, email, totals (activities,
  distance, turf), unlocked achievements → Achievements.
- **Achievements** (`apps/mobile/src/app/achievements.tsx`): every achievement with progress and an
  "n of m unlocked" count, in five groups (Firsts, New streets, Coming back, Getting out, Distance),
  each heading with its own count; unlocked ones in the accent colour. Evaluated on the fly from
  activity and turf facts (nothing stored). List: `docs/decisions/achievements-list-2026-10-23.md`.
- **Sign in** (`apps/mobile/src/app/sign-in.tsx`): email first; the local profiles
  (`admin@cityturfer.com`, `demo@cityturfer.com`) then ask for their password, any other email gets
  a 6-digit code (`textContentType oneTimeCode`), or "Use a password instead" for an account that
  has set an account password. A wrong password shows `sign-in-error`. The first real sign-in on a
  phone whose `admin` profile has activities asks whether to use that history with the account (no
  copy).
- **Account** (`apps/mobile/src/app/account.tsx`, rows in `identity/ui/account-overview.tsx`): name,
  email, account password, sign-in method, data (backed up or on this phone only). Name, email and
  password open their own screens (`account-name.tsx`, `account-email.tsx`, `account-password.tsx`):
  an email change and setting, changing or removing the password ask for an e-mailed code first and
  sign out the account's other sessions. Local profiles change only their name. Sign out (blocked
  while recording; with unsynced backup changes: Back up now / Sign out anyway / Cancel); for
  accounts also Export my data (the server emails a link) and Delete account (warning, then keep or
  delete this phone's data).
- **Restore** (`cloud-backup/ui/restore-card.tsx`, Home): offered when a signed-in account's profile
  has no activities and the backup has some; progress "Restoring n of m…", resumable.
- **Info** (`apps/mobile/src/app/info.tsx`): app version and OTA update id/channel, "Check for
  updates", a data note with the "Estimate GPS gaps along streets" switch, the **Apple Health** card
  (iOS: connect, import and save switches, last import, Import now, Disconnect;
  `health-sync/ui/apple-health-card.tsx`), the **Cloud backup** card
  (`cloud-backup/ui/cloud-backup-card.tsx`: "Back up to CityTurfer cloud" consent switch (off asks
  first: it erases the server copy), "Include Apple Health workouts" on iOS, "Backed up N of M
  activities · last run …", errors in plain words, Back up now; the demo profile never backs up),
  the **Language** card (System, English, Polski). **Developer tools** show in dev builds, or after
  five long presses on the version: the device token and a server URL override for testing
  (`cloud-backup/ui/backup-developer-card.tsx`), **Seed demo history** (90 days around the current
  location, `apps/mobile/src/dev/demo-history.ts`) and, on iOS, **Add sample workouts to Apple
  Health** (`apps/mobile/src/dev/health-seed.ts`) and Remove demo data
  (`apps/mobile/src/dev/developer-tools.tsx`).
- **Your city** (`apps/mobile/src/app/city.tsx` → `territory/ui/city-picker.tsx`): choose the Home
  City from a bundled catalogue (23 Polish, 15 European cities); search ignores accents ("krakow"
  finds Kraków); the current city is ticked; "Clear <city>". Stored per user (`ter_home_city`); its
  id and time go to the server only with Cloud backup on.

## 3. Behind the screens

- **Turf**: claims cells along each recorded segment (H3 res 11), strength from visits only,
  permanent; deleting an activity is the only way turf shrinks.
- **Gap estimates**: street route for recording gaps from the OSM router; distance only, no turf.
- **Data repair job**: `split-track-gaps-v1` re-splits tracks recorded before gap splitting, and
  Territory reclaims from the corrected track.
- **Diagnostics**: `sys_diagnostics` timeline without coordinates, read by
  `apps/mobile/tools/device-diagnose.sh` and `apps/mobile/tools/diagnose-recording.mjs`.
- **OTA**: `expo-updates` checks on load; channel `production`.
- **Languages**: English and Polish (`apps/mobile/src/i18n/`, catalogue
  `apps/mobile/messages/<locale>/<namespace>.json`). Info › Language: System (the phone's language),
  English or Polski, applied at once. Numbers and dates follow the app language (`2,50 km` in
  Polish); new activities get their default name in the language active when they are created; city
  search finds Polish and English names. Design: `docs/decisions/mobile-i18n-2026-10-23.md`.
- **Apple Health sync** (iOS): imports new walks, hikes, runs and rides with routes whenever the app
  comes to the foreground (full history the first time) and saves each new recording to Health with
  its route. No duplicates: `hs_links` remembers every workout in both directions.
- **Accounts**: any email gets a 6-digit code from the API
  (`identity/infrastructure/api-auth-gateway.ts`), which creates the account on first use; the two
  local profiles (`mock-auth-gateway.ts`) keep working in every build. The first account sign-in can
  adopt the `admin` profile's history.
- **Cloud backup** (opt-in, `contexts/cloud-backup`): one-way copy to the CityTurfer API (contract
  `apps/api/openapi.json`). Turning it on records the consent, compares the history with the
  server's manifest and uploads what is missing, oldest first, two at a time; afterwards new
  recordings, renames, deletes, corrected tracks, gap routes and the Home City follow via the
  outbox, and changes made while backup was off are reconciled on the next run. Never `demo-*`;
  `hk-*` only with the Apple Health switch. Network work runs in the foreground only (launch, app
  active, after each outbox run); the outbox handlers just queue (`cb_activities`).
- **Restore**: a new phone signed in to an account with a backup imports it (origin `restore`),
  resumable and paused while recording (`cloud-backup/application/restore.ts`).

## 4. Beyond the phone

- **Server turf** (API contract 0.6.0, `apps/api/src/territory/`): the API builds its own turf
  projection from backed-up activities, with the same rules from `@cityturfer/core`
  (`/v1/turf/cells`, `/v1/turf/summary`, `/v1/activity-totals`). A parity golden keeps phone and
  server turf equal. Only for activities in the backup; nothing on the phone reads it yet.
- **Web portal Slice 0** (`apps/web/src/app/[locale]/account/`): sign in on the website by e-mailed
  code, or create an account from the site header (`/[locale]/account/register`); one page shows
  what the server holds, the backup state, export, delete account and signed-in devices. One
  `__Host-` session cookie through `/api/v1`; public pages stay cookie-free. Design:
  `docs/decisions/web-portal-2026-10-22.md`.
- **Not built yet:** web portal Slice 1 (turf map and activities on the web), the phone pulling
  changes from the server, a web delete removing the activity everywhere, the staff admin portal's
  data views (`apps/admin` is a scaffold with staff sign-in only; no `/internal/admin` routes).
  Planned in `docs/decisions/data-flow-2026-10-23.md` (proposed).

## 5. Known gaps — claims that aren't true yet

- **Apple Health is tested on the Simulator only.** Apple Watch workouts, real permission history
  and large imports need the iPhone (`docs/operations/apple-health.md`).
- **Android has never run on a phone.** Both platforms are first-class on paper. The sideloaded APK
  ran on an emulator (2026-10-18, part of the Maestro suite; `docs/operations/android-release.md`);
  the native background session is iOS-only and `apps/mobile/e2e/run.sh` drives the iOS Simulator
  only.
- **GPX export doesn't exist.** `expo-file-system` and `expo-sharing` are not installed. GPX is read
  only by tests (`apps/mobile/src/test-support/fixtures.ts`).
- **Totals stop at 500 activities.** Dashboard, Stats, Profile, Achievements and the Turf map's
  tracks all read `useActivities()` with its default `limit = 500` (`activity-log/ui/hooks.ts`) and
  aggregate in memory. "All time" undercounts past that.
- **The live track is re-read in full** from SQLite after each location batch (`GetLiveTrack` in
  `recording/application/use-cases.ts`), so long recordings get slower to draw.
- **System prompts stay English.** iOS permission prompts (location, Health) and the app's language
  in iOS Settings need native strings: a later binary release (decision L10 in
  `docs/decisions/mobile-i18n-2026-10-23.md`). Store listings are English only.
- **No city coverage.** There is no "% of your city" gauge; what 100 % means is undecided.
- **The PoC report (M6) isn't written** and the Q4 performance budget (a year of history on a
  mid-range Android) is unmeasured.
- **Achievements have no unlock dates or celebration.**
- **Cloud backup is one-way.** The phone never pulls changes: two phones on one account don't merge,
  and a change made on the web doesn't reach the phone. Bodies are plain JSON (no gzip). Tested
  against the fake server in `pnpm test` and the real API on PGlite in `pnpm test:chain`
  (`tools/chain/run.mjs`, not in CI yet); never against Neon. No Maestro flow covers backup.
- **The phone's "new cells" can differ from the server's.** For a late Apple Health import the phone
  counts first claims by import order; the server keeps the canonical first claimer. Pinned by a
  test; the web takes "new turf" from the server.
