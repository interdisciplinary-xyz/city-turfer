---
status: proposed
verified: 2026-11-19
owner: founder
scope:
  [
    apps/mobile/src/app,
    apps/mobile/src/contexts,
    apps/mobile/src/composition-root.ts,
    apps/mobile/app.json,
    apps/mobile/eas.json,
    apps/mobile/locales,
    apps/mobile/e2e,
    packages/core/src/contexts,
    apps/api/src,
    apps/web/src,
    apps/web/messages,
    apps/admin,
  ]
summary:
  Product feature scope — the one job for the first Turfers, every feature by area with its status
  (Built on v0.16.0, In v0.17.0, Now, Next, Later, Out), the evidence behind it and the assumption
  it rests on; the v0.17.0 "first strangers" scope with progress on the scope head, non-goals and
  the founder decisions it needs
---

# Feature scope

🚧 **Proposed on 2026-11-12 by `product-manager`. Re-checked against code, tests and session logs on
2026-11-19 (`scope/v0.17.0` at `8d4b401`) by `product-manager` with `rn-architect` (app, core, API),
`web-engineer` (website, portal, admin) and `mobile-test-engineer` (flows and device runs).** The
founder accepts, edits or rejects each section; accepted sections make this doc canonical. Code wins
over this doc. Siblings: [product brief](product-brief.md), [strategy](strategy.md) (draft),
[ICP](icp.md) (hypothesis), [discovery board](discovery-board.md),
[launch readiness](launch-readiness.md). Screen-level detail: `docs/engineering/features.md`.

**Evidence rule.** The evidence log in the discovery board is empty: there are no interviews, tester
reports or surveys yet. Every user-value line below is therefore an **assumption**, cited by its id
(A1–A10 in the discovery board) or marked _untested_ when no assumption covers it. Founder requests
are named as such; they are decisions, not evidence. "Evidence" lines per area say how we know a
feature **works** (tests, Simulator, device), not whether people want it.

## 1. The one job

The first Turfer (beachhead 1 in [strategy](strategy.md) §5, sharpened in [ICP](icp.md)) is a
**Polish city dweller, 25–45, with an iPhone and often an Apple Watch**, who walks, runs or rides
several times a week, mostly on the same streets. The job (hypothesis): _"When I head out for my
usual walk or run, I want to see my city fill in and my regular streets glow, so everyday movement
feels like it adds up to something."_ They would hire CityTurfer instead of a list of workouts
(Apple Fitness, Strava, Garmin) because it keeps one permanent picture of their city that brightens
where they return, never ranks them or takes turf away, and keeps routes on the phone unless they
opt in to backup. Untested: A1 (glow is a reason to go out again), A2 (the map is understood without
explanation), A5 (privacy is a reason to choose us), A6 (walkers are the best fit).

Since v0.15.0 the Apple Health import takes only workouts that end after connecting (founder
decision 2026-11-05, `docs/decisions/apple-health-2026-10-18.md`). The "years of turf on day one"
moment in strategy §3 action 1 is gone: turf now starts with the first outing (decision 1, §6).

## 2. Status meanings and test evidence

| Status     | Means                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Built      | On `main`, released as v0.16.0 (2026-11-13). Where it was verified is said per area              |
| In v0.17.0 | Merged into `scope/v0.17.0`, not released                                                        |
| Now        | Proposed for v0.17.0 (§4), not built yet                                                         |
| Next       | Candidate after that; not a promise                                                              |
| Later      | Candidate opportunity; needs evidence or a decision first                                        |
| Out        | Non-goal (§5). Changing one needs a decision record in `docs/decisions/` approved by the founder |

Paths that start with `contexts/` are relative to `apps/mobile/src/`. Maestro flows (21) are in
`apps/mobile/e2e/`.

**How much testing stands behind "Built"** (from `mobile-test-engineer`, 2026-11-19):

- **Last full Maestro run:** #207, 2026-10-31, on `1607339` (v0.14.0), iPhone 17 Pro Simulator iOS
  26.1: 17 of 18 passed; flow 15 failed on password typing, judged a test problem
  (`docs/sessions/v0.14.0.md`). Flows 18 and 19 passed alone later (#217,
  `docs/sessions/v0.15.0.md`). **The full suite has not run on v0.15.0, v0.16.0 or v0.17.0.**
- **Never run:** flows 20 (share photo) and 21 (share prompt). No flow for the no-account start.
  After #236's bundle id change `test:e2e` has not run (it needs a fresh dev build).
- **Real device:** one locked-screen iPhone walk on 2026-10-16 (v0.1.0), one Apple Health import on
  2026-10-19 (v0.4.0), then only reinstalls on an iPhone 14 Pro (2026-10-23 to 11-01). **No device
  check on a v0.16.0 or v0.17.0 build.** `docs/quality/smoke-test.md` has never been filled in.
- **Android:** emulator only (2026-10-18; #227's run was on an overloaded emulator). No real phone.
- **No flow and no device evidence:** Stats, Achievements, the checklist (only its Dashboard card),
  gap routing, auto-pause, kill recovery (Jest only), Health export (Simulator once,
  `docs/quality/e2e.md`).

## 3. Features by area

### Recording

| Feature                                                                                                                                           | Status                                                          | User value                        | Why (assumption)                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------- | --------------------------------------- |
| Record walk, run or ride with live map and stats, auto-pause, pause/resume, hold-to-finish (`apps/mobile/src/app/(tabs)/record.tsx`, flow 02, 04) | Built                                                           | Capture any outing in one tap     | untested; founder's own use is not data |
| Recording with the screen locked; recovery after the app is killed (`contexts/recording/infrastructure/background-task.ts`)                       | Built. Device: once, 2026-10-16 (note below)                    | Never lose a walk                 | A3 (Android); iOS see note              |
| "⬡ Turf" chip under the live track (flow 13)                                                                                                      | Built                                                           | See turf grow while moving        | A1                                      |
| GPS-gap estimation along streets: sends gap endpoints to the OSM router                                                                           | Built, **on** unless turned off; **Now**: default off           | Tidy tracks after tunnels         | untested; launch readiness #4 (privacy) |
| Android recording on a real phone                                                                                                                 | Emulator only (2026-10-18), sideloaded APK; field test **Next** | Android users can trust recording | A3                                      |
| Live track is re-read whole after every batch of fixes                                                                                            | Known limit; Later                                              | Smooth long recordings            | untested                                |

Evidence: flows 02, 03 (Simulator, simulated movement), 04, 13 last passed 2026-10-31. Auto-pause
and kill recovery: Jest only. Gap default read in
`contexts/activity-log/infrastructure/secure-store-gap-estimation-setting.ts` (on unless the stored
value is `'0'`).

**Background tracking note (resolved).** The only real-device evidence for locked-screen recording
is a 65-minute dog walk on an iPhone on **2026-10-16**: screen locked, 4.07 km, fixes arriving as
`live:background` and `session` (`docs/sessions/v0.1.0.md`). The same log notes bursts of fixes
after the screen locks on rides. That run is over a month old and on v0.1.0; recording, the
background task and the build have changed many times since. So: **worked on a device once; not
re-checked on any build a tester would get.** Cheapest check: run flow 03's scenario on the iPhone
on the v0.17.0 build, screen locked, and log it in `docs/sessions/v0.17.0.md` (§4 item 8).

### Turf Map and territory

| Feature                                                                                                                                 | Status                                  | User value                                 | Why (assumption) |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ | ---------------- |
| Turf Map: glow zoomed out, strength-coloured cells zoomed in, type filter, fit-all (`contexts/territory/ui/turf-map-view.tsx`, flow 06) | Built                                   | One picture of "my city"                   | A1, A2           |
| Permanent turf, strength from visits (`packages/core/src/contexts/territory/domain/strength.ts`); Turf gained per activity              | Built                                   | Coming back is rewarded; nothing to lose   | A8               |
| Home City (`apps/mobile/src/app/city.tsx`, flow 12)                                                                                     | Built                                   | Maps open on my city                       | untested         |
| Districts screen and Current city card with district shares (`apps/mobile/src/app/districts.tsx`, flow 18)                              | Built (v0.14.0, v0.15.0)                | Progress in places I know by name          | untested (O1)    |
| Districts progress (more of the plan's "Later")                                                                                         | Later; S–M                              | See which parts of the city are still dark | untested (O1)    |
| Turf legend on the map (`TurfLegend` exists in `@cityturfer/ui`; the app does not use it)                                               | Next                                    | Understand faint → blazing without help    | A2               |
| City coverage %                                                                                                                         | Later; blocked by brief open question 1 | "How much of my city"                      | untested (O1)    |
| Unclaimed streets nearby, route to new turf                                                                                             | Later                                   | Know where to go next                      | untested (O2)    |
| Estimated gap routes claiming turf                                                                                                      | Out for now (brief open question 2)     | —                                          | —                |
| Decay, rivals, contested or stolen turf, closed loops claiming area                                                                     | **Out**                                 | —                                          | principle; A8    |

Evidence: flows 06, 12 passed 2026-10-31; flow 18 alone (#217). Strength formula pinned by
`apps/mobile/tools/fixtures/turf-vectors.json`. Not checked on a device since v0.1.0.

### Activity log and stats

| Feature                                                                                                                                     | Status                                    | User value                   | Why (assumption) |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------- | ---------------- |
| Dashboard: this week, recent, next achievement, checklist (`apps/mobile/src/app/(tabs)/index.tsx`, flow 10)                                 | Built                                     | The week at a glance         | untested         |
| Stats: 8-week chart, turf totals, all-time per type (`apps/mobile/src/app/(tabs)/stats.tsx`)                                                | Built; no flow                            | Progress over time           | untested         |
| History and activity detail: splits, elevation, rename, delete (`apps/mobile/src/app/history.tsx`, `apps/mobile/src/app/activity/[id].tsx`) | Built (flows 05, 07, 14)                  | Review and tidy my outings   | untested         |
| Detail shows an "estimated gap" note and a "From Apple Health" label where they apply                                                       | Built                                     | Know which parts are guessed | untested         |
| Totals capped at 500 activities (`contexts/activity-log/ui/hooks.ts`)                                                                       | Known limit; Next for heavy users         | All-time numbers stay right  | untested         |
| GPX export from the app                                                                                                                     | Next; S, OTA on a v0.16.0-or-later binary | Take my routes anywhere      | untested         |
| History thumbnails                                                                                                                          | Later                                     | Recognise outings faster     | untested         |

The API already writes GPX in the account export (`apps/api/src/privacy/gpx.ts`). `expo-sharing` and
`expo-file-system` arrived with v0.16.0, so in-app GPX export needs no further native change.

Evidence: flows 05, 07, 10, 14 passed 2026-10-31. Stats: tests only, no flow.

### Goals and achievements

| Feature                                                                                                                      | Status                                                | User value                               | Why (assumption)                     |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------- | ------------------------------------ |
| Achievements in five groups, computed live from history (`apps/mobile/src/app/achievements.tsx`)                             | Built; no flow                                        | Small milestones                         | untested                             |
| Getting started checklist (`packages/core/src/contexts/achievements/domain/onboarding.ts`)                                   | Built; only its Dashboard card is in a flow           | First-week guidance; our activation line | untested                             |
| Daily goal in minutes, last 7 days, streak; never a "missed" day (`contexts/goals`, `apps/mobile/src/app/goal.tsx`, flow 19) | Built (v0.15.0)                                       | Habit support without a fitness ring     | founder request 2026-11-10; untested |
| Goal reminders                                                                                                               | Later; M, native (`expo-notifications` not installed) | A nudge at a chosen time                 | untested; must pass the regret test  |
| Unlock moments: dates, celebration                                                                                           | Later; brief open question 5                          | Feel the milestone                       | untested                             |
| Store rating prompt after a positive moment                                                                                  | Later (launch readiness #16)                          | —                                        | —                                    |

Evidence: flow 19 passed alone (#217). #227 found Daily goal content scrolling under the status bar
(§4, decision 4).

### Sharing

| Feature                                                                                                                                         | Status                                                          | User value                              | Why (assumption)                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| Share photo: a 9:16 stats card over my photo, no map, place off by default (`contexts/share-photo`, `apps/mobile/src/app/share-photo/[id].tsx`) | Built (v0.16.0, #225, #231); never run in a flow or on a device | Show an outing without showing my route | founder request 2026-11-11; A9 nearest |
| "Share a photo?" prompt after Finish, with Don't ask again (flow 21)                                                                            | Built (v0.16.0); flow never run                                 | Share at the moment of pride            | untested; plan risk "prompt fatigue"   |
| Save the card as an image through the system share sheet (iOS asks for "add photos" access)                                                     | Built (v0.16.0)                                                 | Keep the card                           | untested                               |
| Direct share to Instagram Stories                                                                                                               | Later (founder, 2026-11-11)                                     | One tap less                            | untested                               |
| Turf-map share image with home trimmed                                                                                                          | Later; needs privacy zones (risk R8)                            | Growth that keeps the privacy promise   | A9                                     |
| Friends, social feed, followers, comments, leaderboards                                                                                         | **Out** (L if ever)                                             | —                                       | principle                              |

Evidence: Jest only. Still open from #225: flows 20 and 21 (never run, #227, #233, #235), the camera
path, a 1080×1920 JPEG without GPS EXIF, Instagram and WhatsApp targets, and the Android checks.
Plan: `docs/plans/share-photo-2026-11-11.md`.

### Apple Health (iOS)

| Feature                                                                                                                       | Status                                                                     | User value                                        | Why (assumption) |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- | ---------------- |
| Import walks, hikes, runs, rides with routes, only workouts that end after connecting (`contexts/health-sync`, flow 11, #214) | Built. Device: once, 2026-10-19, before the forward-only rule              | Watch outings become turf without opening the app | A4               |
| Save recordings to Apple Health                                                                                               | Built; Simulator once, never on a device                                   | One fitness record                                | untested         |
| Import of workouts from before connecting                                                                                     | **Out** by founder decision 2026-11-05 (decision 1 asks whether to reopen) | Day-one glow                                      | A4               |
| Phone and server may count new cells differently after a late Health import                                                   | Known limit                                                                | —                                                 | —                |
| Health Connect (Android)                                                                                                      | Later                                                                      | Android parity                                    | untested         |

Evidence: device import on 2026-10-19 (`docs/sessions/v0.4.0.md`); the forward-only rule is checked
in the Simulator only (flow 11, 2026-10-31).

### Cloud backup and account

| Feature                                                                                                                                                                                | Status                                                                        | User value                                       | Why (assumption)                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| Sign-in with an e-mailed code or an optional password, through Better Auth on the API (`apps/api/src/identity/better-auth.ts`, `contexts/identity/infrastructure/api-auth-gateway.ts`) | Built (flow 01)                                                               | My account works on any phone                    | untested                              |
| Sign-in is a wall in front of the whole app (`apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/sign-in.tsx`)                                                                     | Built — **contradicts decision B1** (`docs/plans/backend-plan-2026-10-22.md`) | —                                                | A5 cannot be tested while it stands   |
| Mock `admin@` and `demo@` profiles open in every build (`apps/mobile/src/composition-root.ts`)                                                                                         | Built; **Now**: hide in release builds                                        | —                                                | —                                     |
| **Use without an account** (local-only as a full mode, B1)                                                                                                                             | **Now**; not started                                                          | Try it with no sign-up; the privacy line is true | A5; launch readiness #2 (Apple 5.1.1) |
| Opt-in one-way cloud backup; Health uploads behind a second switch (Info › Cloud backup, flow 17)                                                                                      | Built                                                                         | My turf survives a lost phone                    | A10 (evidence 0)                      |
| Link a local profile to backup with an e-mailed code (`apps/mobile/src/app/link-backup.tsx`, flow 17)                                                                                  | Built                                                                         | Keep the history I already have                  | A10                                   |
| Restore onto a new phone (`contexts/cloud-backup/application/restore.ts`)                                                                                                              | Built                                                                         | Pick up where I left off                         | A10                                   |
| Account: name, e-mail, password, export by e-mailed link, delete (`apps/mobile/src/app/account.tsx`, flow 15)                                                                          | Built; flow 15 last failed (test-side)                                        | Control over my data                             | untested; store duty                  |
| Device tokens still accepted as a stopgap (`apps/api/src/auth/device-tokens.ts`, wired in `apps/api/src/wiring.ts`)                                                                    | Built; **Now**: retire                                                        | —                                                | —                                     |
| Two-way sync (server → phone pull, decisions F1–F4 in `docs/decisions/data-flow-2026-10-23.md`)                                                                                        | Decided, not built; Later; L                                                  | Two phones, one turf                             | A10 (evidence 0)                      |
| API turf read routes (`/v1/turf/summary`, cells, claims, home city: `apps/api/src/territory`)                                                                                          | Built on the API; only a generated type in the web client, no caller          | —                                                | —                                     |
| Sign in with Apple                                                                                                                                                                     | Later (part of the login-model question)                                      | —                                                | —                                     |

Evidence: flows 01, 08, 17 passed 2026-10-31 (17 needs the API); flow 15 failed at CP-12.

### Me, Profile and Info

| Feature                                                                                                                                        | Status                              | User value                        | Why (assumption) |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------- | ---------------- |
| Me menu (`apps/mobile/src/app/(tabs)/me.tsx`, flow 09) and Profile screen (`apps/mobile/src/app/profile.tsx`)                                  | Built                               | One place for me and my settings  | untested         |
| Info › Check for updates (`apps/mobile/src/app/info.tsx`)                                                                                      | Built                               | Get fixes without reinstalling    | untested         |
| Info › "Your data": what stays on the phone and what leaves it (`apps/mobile/messages/en/info.json`, `yourDataBody`, `estimateGapsOff`)        | Built                               | Know what is sent before trusting | A5               |
| Developer tools unlocked by tapping Info, also in release builds (`apps/mobile/src/app/info.tsx`, `DeveloperToolsCard`, `BackupDeveloperCard`) | Built; **cohort risk**; decision 10 | —                                 | —                |

Evidence: flow 09 passed 2026-10-31. Check for updates and the developer-tools unlock: read in code,
not run in a flow.

### Website (`apps/web`)

| Feature                                                                                                                                                                                                       | Status                                                                             | User value                   | Why (assumption) |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- | ---------------- |
| Homepage that explains the value: hero, How it works, Highlights, Who it’s for, Local first, FAQ, Join; header and footer link every section (#238); faster first paint (#226) and accessibility fixes (#223) | Built (v0.17.0)                                                                    | —                            | founder call     |
| Hero buttons go to `#join` ("Join the waitlist", or "How to get it" without the waitlist) and `#how` (`apps/web/src/domains/homepage/components/hero-copy/hero-copy.tsx`)                                     | Built (v0.17.0); fixes #227 must-fix (decision 6)                                  | —                            | —                |
| Home sections, FAQ, footer and header section links                                                                                                                                                           | Built, shown                                                                       | —                            | —                |
| OpenStreetMap credit for the hero street map (map corner and footer)                                                                                                                                          | Built                                                                              | —                            | —                |
| Waitlist with Brevo double opt-in (`apps/web/src/domains/waitlist/waitlist-config.ts`)                                                                                                                        | Built; form in `#join` when the waitlist env vars are set, a closed line otherwise | Our only recruiting channel  | A6 needs it      |
| English and Polish site; sitemap for `/en` and `/pl`; share image                                                                                                                                             | Built                                                                              | —                            | —                |
| 404 page                                                                                                                                                                                                      | Not built: Next's default, unbranded, English on `/pl`                             | —                            | —                |
| Privacy policy and terms, PL and EN                                                                                                                                                                           | **Now**; not started (no route)                                                    | Trust before giving location | A5               |
| Headline variants (privacy vs glow)                                                                                                                                                                           | Next                                                                               | Learn which promise pulls    | A5               |
| Disclosed fake doors: "Back up your turf", "Founding Turfer"                                                                                                                                                  | Later                                                                              | Test demand before building  | A10, A7          |

Evidence: #238 code review on 2026-11-25 (web tsc, lint, depcruise, unit tests, `audit:i18n`); the
landing specs (`test:e2e`, and `test:e2e:closed` without the waitlist) match the new page but were
not run in that review, and it was not rendered in a browser. Whether Vercel sets the waitlist env
vars is not checked (founder).

### Web portal (`/[locale]/account`)

| Feature                                                                                     | Status                                                     | User value                          | Why (assumption) |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------- | ---------------- |
| Sign-in; account, devices, export, delete                                                   | Built                                                      | Manage my account on a laptop       | untested         |
| Backed-up activity list and detail with a route drawing (`apps/web/src/domains/activities`) | Built                                                      | My history on a big screen          | untested         |
| Register page reachable only by URL; nothing links to it                                    | Built as is; open                                          | —                                   | —                |
| Delete an activity on the web                                                               | Later                                                      | Tidy from the laptop                | untested         |
| Turf map on the web                                                                         | Later; M; map tiles break the portal's no-third-party line | See my glowing city on a big screen | untested         |

Evidence: code read 2026-11-19. Five Storybook stories crash, three of them portal ones (#227
must-fix, decision 4).

### Admin (`apps/admin`)

| Feature                                                   | Status                                  | User value                   | Why |
| --------------------------------------------------------- | --------------------------------------- | ---------------------------- | --- |
| Payload scaffold with staff accounts only                 | Built, not deployed, paused             | Support staff (no users yet) | —   |
| User support through audited `/internal/admin` API routes | Not built; Later; L; decision AD3 first | Help a Turfer who is stuck   | —   |

### Languages

| Feature                                                                                                     | Status                               | User value                       | Why (assumption) |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------- | ---------------- |
| App in English and Polish (Info › Language, flow 16)                                                        | Built                                | My language                      | untested         |
| Polish iOS permission prompts: location, Health, camera, add photos (`apps/mobile/locales/pl.json`, #236)   | **In v0.17.0**; not seen on a device | The first prompt reads in Polish | untested         |
| Rest of L10: app language in iOS Settings, Android locale list (`docs/decisions/mobile-i18n-2026-10-23.md`) | Not built; native; decision 11       | Pick the app's language per app  | untested         |
| Store listings PL and EN                                                                                    | Later (with the stores)              | —                                | —                |
| More languages                                                                                              | Out for now                          | —                                | —                |

Evidence: flow 16 passed 2026-10-31. The Polish prompts are config only; nobody has seen them on a
Polish iPhone yet.

## 4. v0.17.0: "first strangers" (proposed)

**Outcome.** About 8 non-friend iPhone testers from beachhead 1 install CityTurfer, start without an
account, and tell us what happened. Appetite: 2 weeks, solo. Circuit breaker (proposed date
2026-12-03): if "use without an account" isn't shippable by then, ship the rest and keep the cohort
to people who accept sign-in, and write that down as a bias.

**Done means (user outcomes) and progress on `8d4b401` (2026-11-19):**

| #   | Done means                                                                                                                                                                            | On the scope head | Where                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | On a fresh install a tester reaches the Dashboard without typing an e-mail, and can record, see turf, connect Apple Health and use every local screen. Only map tiles leave the phone | Not started       | `apps/mobile/src/app/_layout.tsx` still sends everyone to sign-in                                                                                                                                                                                              |
| 2   | If they later turn on backup, the app asks for an account then, and the history already on the phone comes with them                                                                  | Partly            | The link step exists (`apps/mobile/src/app/link-backup.tsx`, flow 17); it only matters once item 1 exists                                                                                                                                                      |
| 3   | Before the first location prompt they can open a PL and EN privacy policy from the app and the website, naming every flow in [launch readiness](launch-readiness.md)                  | Not started       | No route in `apps/web`; no in-app link                                                                                                                                                                                                                         |
| 4   | They can send feedback in two taps; the message holds only what they read and approved (counts, km, cells, days active, version), never coordinates, cell ids or place names          | Not started       | —                                                                                                                                                                                                                                                              |
| 5   | Gap estimation stays off until they turn it on; Info says what it sends                                                                                                               | Partly            | Info text built (`yourDataBody`, `estimateGapsOff`); default still on (`contexts/activity-log/infrastructure/secure-store-gap-estimation-setting.ts`)                                                                                                          |
| 6   | On a Polish iPhone the location, camera and Health permission prompts read in Polish                                                                                                  | Built (#236)      | `apps/mobile/locales/pl.json`; not seen on a device                                                                                                                                                                                                            |
| 7   | They got the app through TestFlight, not through founder-side signing                                                                                                                 | Partly (#236)     | `apps/mobile/eas.json` store profile and submit config, bundle id `com.cityturfer.app` (Android stays `com.turftrack.poc`); App Store Connect app id missing, nothing uploaded, account not enrolled (decision 3, T1 in `docs/plans/testflight-2026-11-12.md`) |
| 8   | Verified on a real iPhone: a new Maestro flow for the no-account start, and a dated device run of flows 01, 02, 03, 11, 20 and 21, written in the session log                         | Not started       | No no-account flow; flows 20 and 21 never run; no device run on v0.16.0 or v0.17.0                                                                                                                                                                             |

**Also needed before strangers get a build** (not user outcomes, but each one is visible to a
tester):

| Item                                                        | On the scope head | Where                                                                                                                           |
| ----------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Hide the mock `admin@` / `demo@` profiles in release builds | Not started       | `apps/mobile/src/composition-root.ts` has no build check; `eas.json` sets `EXPO_PUBLIC_APP_ENV=production` but nothing reads it |
| Hide developer tools in release builds                      | Not started       | `apps/mobile/src/app/info.tsx` (decision 10)                                                                                    |
| Retire device tokens on the API                             | Not started       | `apps/api/src/wiring.ts`                                                                                                        |
| OpenStreetMap credit on the homepage                        | Done              | Map corner and footer (#238)                                                                                                    |
| #227 must-fix items                                         | Open              | `docs/sessions/v0.17.0.md` "Carried over"; decision 4                                                                           |

So far 1 of 8 outcomes is built (Polish iOS prompts) and 3 are partly done; the core of the release,
the no-account start, has not started.

**Carried over from the v0.16.0 global review (#227), still open:** (1) hero buttons do nothing
(fixed by #238); (2) five Storybook stories crash; (3) app content scrolls under the status bar on
Daily goal and the Dashboard, and the wordmark sits over the clock on the code sign-in step; (4)
Android does not load the brand fonts (dev build); (5) a possible Android freeze (ANR) during a
recording replay on an overloaded emulator. Fix in v0.17.0 or accept: decision 4.

**What we learn (pre-register on the discovery board before the cohort starts):** the board's
outcome (≥3 activities in weeks 2–4, unnudged); A2 by 5 hallway tests (≥4/5 find "your streets and
the ones you visit most" unaided); A1 by a 2–3 week diary study.

**Not in this release:** turf legend, coverage %, GPX export, Health Connect, two-way sync, Stories
deep link, web turf map, branded 404, admin, Android public release.

### Size and native impact (Now and Next)

| Item                                                                                       | Size | Native build?               | Risk                                                                                                     |
| ------------------------------------------------------------------------------------------ | ---- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Real-auth remainder: no-account start, retire device tokens, hide mock profiles in release | S–M  | No (JS)                     | The app keys everything to a profile id (one SQLite database per profile; the background task reads it)  |
| Hide developer tools in release builds                                                     | S    | No (JS)                     | Same build check as the mock profiles                                                                    |
| Privacy policy and terms (site) + in-app link                                              | S    | No                          | Legal wording; must match the data-flow table                                                            |
| In-app feedback with a user-approved, non-spatial summary                                  | S    | No                          | Must never include coordinates or places                                                                 |
| Gap estimation off by default                                                              | S    | No                          | Existing users keep their choice or not: decide (decision 8)                                             |
| Polish iOS permission strings (L10, part)                                                  | S    | **Yes**; done (#236)        | Rides the TestFlight binary; not yet seen on a device                                                    |
| Rest of L10: iOS per-app language, Android locale list                                     | S?   | **Yes**                     | Size not checked; decision 11                                                                            |
| TestFlight distribution                                                                    | —    | **Yes**; code done (#236)   | Blocked on the developer account (T1) and the App Store Connect record                                   |
| GPX export in the app (Next)                                                               | S    | No (OTA on v0.16.0+ binary) | —                                                                                                        |
| Turf legend (Next)                                                                         | S    | No                          | —                                                                                                        |
| Android public release (Next or Later)                                                     | L    | Yes                         | No real-phone run; Play background-location video and declarations; `RECEIVE_BOOT_COMPLETED` unjustified |
| Two-way sync (Later)                                                                       | L    | No                          | Conflicts and tombstones on the phone; A10 has no evidence                                               |

**v0.17.0 native impact.** #236 changes the native build: Polish locale strings, the new iOS bundle
id `com.cityturfer.app`, and removed motion and Face ID permission keys. So v0.17.0 needs a new
binary; it can't ship over the air. Everything else in this scope is JS and can ride that binary.
The new bundle id installs as a separate app beside the old one; how the old app's data is kept safe
is in `docs/plans/testflight-2026-11-12.md`. `apps/mobile/app.json` still says 0.16.0 on the scope:
that is by design, the release workflow bumps it when the release merges to `main`.

## 5. Non-goals

| Not building                                                   | Why                                                                                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Leaderboards, rivals, contested or stolen turf, crews, seasons | Puts us in the most crowded group ([market landscape](market-landscape.md) §1); breaks "glow, never casino" and permanent turf   |
| Turf decay or reset; guilt over a broken streak                | Regret test; A8 bets on permanence. The Daily goal never shows "missed"                                                          |
| Social feed, friends, followers, comments, public profiles     | Single-user product; a public map can reveal home (R8). Sharing stays an image the Turfer sends                                  |
| Analytics or telemetry on coordinates, cells or places         | Principle (CLAUDE.md hard rules). We learn through interviews, diaries and user-approved non-spatial summaries                   |
| A required account or upload                                   | Decision B1; Apple 5.1.1. Backup stays opt-in and off by default                                                                 |
| Android-only features and parity work (Health Connect etc.)    | Not before A3 passes on a real phone; the APK is a "preview" until then. A deliberate, temporary narrowing (iOS ~36 % in Poland) |
| Pricing, paywall, payments                                     | No value evidence; A7 is "later". At most a disclosed "Founding Turfer" fake door. Never paywall turf, data or export            |
| Admin portal work                                              | No users to support; paused; AD3 open                                                                                            |
| A map or route on share images                                 | Privacy (R8); waits for privacy zones                                                                                            |

## 6. Decisions for the founder

The 2026-11-12 decision 4 (native path for v0.16.0) is settled: v0.16.0 shipped on 2026-11-13 and
the Polish iOS strings ride v0.17.0's binary instead. Number 4 now holds the #227 carry-over.

| #   | Decision                                                 | Recommendation                                                                                                                                                                                                                                                                                                      | Trade-off                                                                                       |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Beachhead now that Health import only goes forward       | Keep beachhead 1; drop "day-one wow" from positioning and test glow on return (A1) instead                                                                                                                                                                                                                          | A limited back-import (e.g. last 90 days) would restore the wow but reverse the 2026-11-05 call |
| 2   | Use without an account (B1) in v0.17.0                   | Yes, and start it now: it is the core of the release and has not started. Keep the circuit breaker date (2026-12-03)                                                                                                                                                                                                | About a week; a third identity path beside account and mock profiles                            |
| 3   | Apple Developer enrolment as an organisation (D-U-N-S)   | Start now: the TestFlight code is done (#236), so the account (T1) and the App Store Connect record are now the only blockers for any stranger cohort                                                                                                                                                               | US$99 a year; DSA trader details published                                                      |
| 4   | #227 must-fix items: fix in v0.17.0 or accept            | Fix in v0.17.0 what a tester or visitor sees: hero buttons (decision 6) and content under the status bar. Fix the five Storybook stories (small, internal). Accept Android fonts and the possible ANR for now (Android stays "preview"); re-check both on a real phone with A3                                      | A few days of the 2-week appetite; accepting the Android items keeps an unknown open            |
| 5   | Two-way sync vs launch blockers                          | Launch blockers first (no-account start, privacy policy, TestFlight). Two-way sync (L) waits until A10 has any evidence; restore already covers a new phone                                                                                                                                                         | A Turfer with two phones sees only one phone's turf                                             |
| 6   | Hero buttons and recruiting while the waitlist is hidden | Remove "See your turf glow" or point it at something that exists; give the hero one working waitlist call to action (mount the form or link to Brevo), with the optional "Walk, run or ride?" question if Brevo allows. Confirm whether Vercel sets the waitlist env vars. Meanwhile recruit 5 interviewees by hand | The page is a little less minimal                                                               |
| 7   | Android                                                  | "Preview" everywhere until one real-phone field test passes A3; no Android-only work                                                                                                                                                                                                                                | Android is about two-thirds of Polish phones                                                    |
| 8   | Gap-estimation default                                   | Off by default (opt-in), also for existing installs unless they turned it on themselves                                                                                                                                                                                                                             | Dashed gaps for testers who don't turn it on                                                    |
| 9   | Discovery before Next bets                               | Daily goal and Share photo were built on founder requests with no evidence; run 5 non-friend interviews before shaping any Next item                                                                                                                                                                                | Slower Next; fewer wasted builds                                                                |
| 10  | Developer tools in release builds                        | Hide them (and the mock profiles) in release builds in v0.17.0, using the same build check. A stranger who taps Info a few times should not reach seed or backup tools                                                                                                                                              | Harder for the founder to debug a tester's phone; a debug build still has them                  |
| 11  | Rest of L10 (iOS per-app language, Android locale list)  | iOS part in v0.17.0's binary if `rn-architect` confirms it is config only, since a new binary is needed anyway; Android part waits for Android work (decision 7)                                                                                                                                                    | Without it a Polish user can change the app language only inside the app (Info › Language)      |
| 12  | This doc                                                 | Accept, edit or reject §4–§5; accepted sections make it canonical                                                                                                                                                                                                                                                   | —                                                                                               |
