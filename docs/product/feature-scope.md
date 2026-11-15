---
status: proposed
verified: 2026-11-12
owner: founder
scope:
  [
    apps/mobile/src/app,
    apps/mobile/src/contexts,
    apps/mobile/src/composition-root.ts,
    apps/mobile/app.json,
    apps/mobile/e2e,
    packages/core/src/contexts,
    apps/api/src,
    apps/web/src,
    apps/web/messages,
    apps/admin,
  ]
summary:
  Product feature scope — the one job for the first Turfers, every feature by area with its status
  (Built, v0.16.0, Now, Next, Later, Out) and the assumption behind it, the next release's scope
  line, non-goals and the founder decisions it needs
---

# Feature scope

🚧 **Proposed on 2026-11-12 by `product-manager`, merged with an `rn-architect` inventory checked
against code the same day.** The founder accepts, edits or rejects each section; accepted sections
make this doc canonical. Code wins over this doc. Siblings: [product brief](product-brief.md),
[strategy](strategy.md) (draft), [ICP](icp.md) (hypothesis), [discovery board](discovery-board.md),
[launch readiness](launch-readiness.md). Screen-level detail: `docs/engineering/features.md`.

**Evidence rule.** The evidence log in the discovery board is empty: there are no interviews, tester
reports or surveys yet. Every user-value line below is therefore an **assumption**, cited by its id
(A1–A10 in the discovery board) or marked _untested_ when no assumption covers it. Founder requests
are named as such; they are decisions, not evidence.

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

## 2. Status meanings

| Status     | Means                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Built      | On `main` (v0.15.0). Where it was verified is said per row                                       |
| In v0.16.0 | Merged into `scope/v0.16.0`, not released                                                        |
| Now        | Proposed for the next release (§4)                                                               |
| Next       | Candidate after that; not a promise                                                              |
| Later      | Candidate opportunity; needs evidence or a decision first                                        |
| Out        | Non-goal (§5). Changing one needs a decision record in `docs/decisions/` approved by the founder |

Paths that start with `contexts/` are relative to `apps/mobile/src/`. Maestro flows are in
`apps/mobile/e2e/`.

## 3. Features by area

### Recording

| Feature                                                                                                                                           | Status                                                                     | User value                        | Why (assumption)                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------- | --------------------------------------- |
| Record walk, run or ride with live map and stats, auto-pause, pause/resume, hold-to-finish (`apps/mobile/src/app/(tabs)/record.tsx`, flow 02, 04) | Built (Simulator, tests)                                                   | Capture any outing in one tap     | untested; founder's own use is not data |
| Recording with the screen locked; recovery after the app is killed (`contexts/recording/infrastructure/background-task.ts`)                       | Built. **Evidence conflicts**: see note below                              | Never lose a walk                 | A3 (Android); iOS untested on record    |
| "⬡ Turf" chip under the live track (flow 13)                                                                                                      | Built                                                                      | See turf grow while moving        | A1                                      |
| GPS-gap estimation along streets: sends gap endpoints to the OSM router                                                                           | Built, on unless turned off; **Now**: default off                          | Tidy tracks after tunnels         | untested; launch readiness #4 (privacy) |
| Android recording on a real phone                                                                                                                 | Emulator only (2026-10-18), sideloaded APK; field test **Next** (decision) | Android users can trust recording | A3                                      |
| Live track is re-read whole after every batch of fixes                                                                                            | Known limit; Later                                                         | Smooth long recordings            | untested                                |

**Background tracking note.** Brief §7 says iOS Q1 (locked-screen recording) passed on a device. The
architect found no documented real-device run: only the Simulator flow
`apps/mobile/e2e/03-background-recording.yaml` and a unit test for kill recovery. Until a dated
device run is written down, this is **not verified**. Cheapest check: run flow 03's scenario on the
iPhone with simulated or real movement, screen locked (the `mobile-testing` skill), and log it in
the session log.

### Turf Map and territory

| Feature                                                                                                                                 | Status                                  | User value                                 | Why (assumption) |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ | ---------------- |
| Turf Map: glow zoomed out, strength-coloured cells zoomed in, type filter, fit-all (`contexts/territory/ui/turf-map-view.tsx`, flow 06) | Built                                   | One picture of "my city"                   | A1, A2           |
| Permanent turf, strength from visits (`packages/core/src/contexts/territory/domain/strength.ts`); Turf gained per activity              | Built                                   | Coming back is rewarded; nothing to lose   | A8               |
| Home City (`apps/mobile/src/app/city.tsx`, flow 12)                                                                                     | Built                                   | Maps open on my city                       | untested         |
| Districts screen and Current city card with district shares (`apps/mobile/src/app/districts.tsx`, flow 18)                              | Built (v0.14.0, v0.15.0)                | Progress in places I know by name          | untested (O1)    |
| Districts progress (more of the plan's "Later")                                                                                         | Later; S–M                              | See which parts of the city are still dark | untested (O1)    |
| Turf legend on the map (brand copy exists; the app does not use it)                                                                     | Next                                    | Understand faint → blazing without help    | A2               |
| City coverage %                                                                                                                         | Later; blocked by brief open question 1 | "How much of my city"                      | untested (O1)    |
| Unclaimed streets nearby, route to new turf                                                                                             | Later                                   | Know where to go next                      | untested (O2)    |
| Estimated gap routes claiming turf                                                                                                      | Out for now (brief open question 2)     | —                                          | —                |
| Decay, rivals, contested or stolen turf, closed loops claiming area                                                                     | **Out**                                 | —                                          | principle; A8    |

### Activity log and stats

| Feature                                                                                                                                     | Status                                    | User value                  | Why (assumption) |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------- | ---------------- |
| Dashboard: this week, recent, next achievement, checklist (`apps/mobile/src/app/(tabs)/index.tsx`, flow 10)                                 | Built                                     | The week at a glance        | untested         |
| Stats: 8-week chart, turf totals, all-time per type (`apps/mobile/src/app/(tabs)/stats.tsx`)                                                | Built                                     | Progress over time          | untested         |
| History and activity detail: splits, elevation, rename, delete (`apps/mobile/src/app/history.tsx`, `apps/mobile/src/app/activity/[id].tsx`) | Built (flows 05, 07, 14)                  | Review and tidy my outings  | untested         |
| Totals capped at 500 activities (Dashboard, Stats, Achievements load up to 500)                                                             | Known limit; Next for heavy users         | All-time numbers stay right | untested         |
| GPX export from the app                                                                                                                     | Next; S, OTA after v0.16.0's native build | Take my routes anywhere     | untested         |
| History thumbnails                                                                                                                          | Later                                     | Recognise outings faster    | untested         |

The API already writes GPX in the account export (`apps/api/src/privacy/gpx.ts`); `expo-sharing` and
`expo-file-system` arrive with v0.16.0, so in-app GPX export needs no further native change.

### Goals and achievements

| Feature                                                                                                                      | Status                                                | User value                               | Why (assumption)                     |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------- | ------------------------------------ |
| Achievements in five groups, computed live from history (`apps/mobile/src/app/achievements.tsx`)                             | Built                                                 | Small milestones                         | untested                             |
| Getting started checklist (`packages/core/src/contexts/achievements/domain/onboarding.ts`)                                   | Built                                                 | First-week guidance; our activation line | untested                             |
| Daily goal in minutes, last 7 days, streak; never a "missed" day (`contexts/goals`, `apps/mobile/src/app/goal.tsx`, flow 19) | Built in **v0.15.0** (not v0.16.0)                    | Habit support without a fitness ring     | founder request 2026-11-10; untested |
| Goal reminders                                                                                                               | Later; M, native (`expo-notifications` not installed) | A nudge at a chosen time                 | untested; must pass the regret test  |
| Unlock moments: dates, celebration                                                                                           | Later; brief open question 5                          | Feel the milestone                       | untested                             |
| Store rating prompt after a positive moment                                                                                  | Later (launch readiness #16)                          | —                                        | —                                    |

### Sharing

| Feature                                                                                                                                         | Status                                     | User value                              | Why (assumption)                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------- | -------------------------------------- |
| Share photo: a 9:16 stats card over my photo, no map, place off by default (`contexts/share-photo`, `apps/mobile/src/app/share-photo/[id].tsx`) | **In v0.16.0**; device checks open (below) | Show an outing without showing my route | founder request 2026-11-11; A9 nearest |
| "Share a photo?" prompt after Finish, with Don't ask again (flow 21)                                                                            | **In v0.16.0**                             | Share at the moment of pride            | untested; plan risk "prompt fatigue"   |
| Direct share to Instagram Stories                                                                                                               | Later (founder, 2026-11-11)                | One tap less                            | untested                               |
| Turf-map share image with home trimmed                                                                                                          | Later; needs privacy zones (risk R8)       | Growth that keeps the privacy promise   | A9                                     |
| Friends, social feed, followers, comments, leaderboards                                                                                         | **Out** (L if ever)                        | —                                       | principle                              |

Share photo device checks still open (from PR #225): Maestro flows 20 and 21 not run for the PR;
camera path, a 1080×1920 JPEG without GPS EXIF, Instagram and WhatsApp targets, and the Android
checks. Plan: `docs/plans/share-photo-2026-11-11.md`.

### Apple Health (iOS)

| Feature                                                                                                                       | Status                                                                                                                  | User value                                        | Why (assumption) |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------- |
| Import walks, hikes, runs, rides with routes, only workouts that end after connecting (`contexts/health-sync`, flow 11, #214) | Built. Import worked on the iPhone on 2026-10-19 (brief §10), before the forward-only rule; that rule is Simulator-only | Watch outings become turf without opening the app | A4               |
| Save recordings to Apple Health                                                                                               | Built; not checked on a device                                                                                          | One fitness record                                | untested         |
| Import of workouts from before connecting                                                                                     | **Out** by founder decision 2026-11-05 (decision 1 asks whether to reopen)                                              | Day-one glow                                      | A4               |
| Phone and server may count new cells differently after a late Health import                                                   | Known limit                                                                                                             | —                                                 | —                |
| Health Connect (Android)                                                                                                      | Later                                                                                                                   | Android parity                                    | untested         |

### Cloud backup and account

| Feature                                                                                                                                                                                | Status                                                                        | User value                                       | Why (assumption)                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| Sign-in with an e-mailed code or an optional password, through Better Auth on the API (`apps/api/src/identity/better-auth.ts`, `contexts/identity/infrastructure/api-auth-gateway.ts`) | Built                                                                         | My account works on any phone                    | untested                              |
| Sign-in is a wall in front of the whole app (`apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/sign-in.tsx`)                                                                     | Built — **contradicts decision B1** (`docs/plans/backend-plan-2026-10-22.md`) | —                                                | A5 cannot be tested while it stands   |
| Mock `admin@` and `demo@` profiles open in every build (`apps/mobile/src/composition-root.ts`)                                                                                         | Built; **Now**: hide in release builds                                        | —                                                | —                                     |
| **Use without an account** (local-only as a full mode, B1)                                                                                                                             | **Now**; not built                                                            | Try it with no sign-up; the privacy line is true | A5; launch readiness #2 (Apple 5.1.1) |
| Opt-in one-way cloud backup; Health uploads behind a second switch (Info › Cloud backup, flow 17)                                                                                      | Built                                                                         | My turf survives a lost phone                    | A10 (evidence 0)                      |
| Restore onto a new phone (`contexts/cloud-backup/application/restore.ts`)                                                                                                              | Built                                                                         | Pick up where I left off                         | A10                                   |
| Account: name, e-mail, password, export by e-mailed link, delete (`apps/mobile/src/app/account.tsx`, flow 15)                                                                          | Built                                                                         | Control over my data                             | untested; store duty                  |
| Device tokens still accepted as a stopgap (`apps/api/src/auth/device-tokens.ts`)                                                                                                       | Built; **Now**: retire                                                        | —                                                | —                                     |
| Two-way sync (server → phone pull, decisions F1–F4 in `docs/decisions/data-flow-2026-10-23.md`)                                                                                        | Decided, not built; Later; L                                                  | Two phones, one turf                             | A10 (evidence 0)                      |
| API turf read routes (`/v1/turf/summary`, cells, claims, home city: `apps/api/src/territory`)                                                                                          | Built on the API; nothing on the phone or web reads them                      | —                                                | —                                     |
| Sign in with Apple                                                                                                                                                                     | Later (part of the login-model question)                                      | —                                                | —                                     |

### Website (`apps/web`)

| Feature                                                                                                                                                         | Status                                         | User value                   | Why (assumption) |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------- | ---------------- |
| Homepage trimmed to header and hero; sections, waitlist and footer hidden (founder, 2026-11-12)                                                                 | In progress: uncommitted on `feat/share-photo` | —                            | founder call     |
| Hero "Join" button still links to the removed `#waitlist` section when the waitlist is set (`apps/web/src/domains/homepage/components/hero-copy/hero-copy.tsx`) | Bug to check (read in code, not rendered)      | —                            | —                |
| Waitlist with Brevo double opt-in                                                                                                                               | Built, hidden                                  | Our only recruiting channel  | A6 needs it      |
| English and Polish site                                                                                                                                         | Built                                          | —                            | —                |
| Privacy policy and terms, PL and EN                                                                                                                             | **Now** (launch readiness #3)                  | Trust before giving location | A5               |
| Headline variants (privacy vs glow)                                                                                                                             | Next                                           | Learn which promise pulls    | A5               |
| Disclosed fake doors: "Back up your turf", "Founding Turfer"                                                                                                    | Later                                          | Test demand before building  | A10, A7          |

### Web portal (`/[locale]/account`)

| Feature                                                                                     | Status                                                     | User value                          | Why (assumption) |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------- | ---------------- |
| Sign-in; account, devices, export, delete                                                   | Built                                                      | Manage my account on a laptop       | untested         |
| Backed-up activity list and detail with a route drawing (`apps/web/src/domains/activities`) | Built                                                      | My history on a big screen          | untested         |
| Register page reachable only by URL; no portal link on the homepage                         | Built as is; open                                          | —                                   | —                |
| Delete an activity on the web                                                               | Later                                                      | Tidy from the laptop                | untested         |
| Turf map on the web                                                                         | Later; M; map tiles break the portal's no-third-party line | See my glowing city on a big screen | untested         |

### Admin (`apps/admin`)

| Feature                                                   | Status                                  | User value                   | Why |
| --------------------------------------------------------- | --------------------------------------- | ---------------------------- | --- |
| Payload scaffold with staff accounts only                 | Built, not deployed, paused             | Support staff (no users yet) | —   |
| User support through audited `/internal/admin` API routes | Not built; Later; L; decision AD3 first | Help a Turfer who is stuck   | —   |

### Languages

| Feature                                                        | Status                                               | User value                       | Why (assumption) |
| -------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------- | ---------------- |
| App in English and Polish (Info › Language, flow 16)           | Built                                                | My language                      | untested         |
| iOS permission prompts and Android locale list in Polish (L10) | **Now**; joins the native build v0.16.0 needs anyway | The first prompt reads in Polish | untested         |
| Store listings PL and EN                                       | Later (with the stores)                              | —                                | —                |
| More languages                                                 | Out for now                                          | —                                | —                |

## 4. Next release: "first strangers" (proposed v0.17.0)

**Outcome.** About 8 non-friend iPhone testers from beachhead 1 install CityTurfer, start without an
account, and tell us what happened. Appetite: 2 weeks, solo. Circuit breaker: if "use without an
account" isn't shippable in 2 weeks, ship the rest and keep the cohort to people who accept sign-in,
and write that down as a bias.

**Done means (user outcomes):**

1. On a fresh install a tester reaches the Dashboard without typing an e-mail, and can record, see
   turf, connect Apple Health and use every local screen. Only map tiles leave the phone.
2. If they later turn on backup, the app asks for an account then, and the history already on the
   phone comes with them (the existing "Use this phone's history?" step).
3. Before the first location prompt they can open a PL and EN privacy policy from the app and the
   website, naming every flow in [launch readiness](launch-readiness.md).
4. They can send feedback in two taps; the message holds only what they read and approved (counts,
   km, cells, days active, version), never coordinates, cell ids or place names.
5. Gap estimation stays off until they turn it on; Info says what it sends.
6. On a Polish iPhone the location, camera and Health permission prompts read in Polish.
7. They got the app through TestFlight, not through founder-side signing (decision 3).
8. Verified on a real iPhone: a new Maestro flow for the no-account start, and a dated device run of
   flows 01, 02, 03, 11, 20 and 21, written in the session log.

**What we learn (pre-register on the discovery board before the cohort starts):** the board's
outcome (≥3 activities in weeks 2–4, unnudged); A2 by 5 hallway tests (≥4/5 find "your streets and
the ones you visit most" unaided); A1 by a 2–3 week diary study.

**v0.16.0 is done when** the Share photo device checks pass (§3 Sharing) on a native build, and the
homepage trim is committed with a working call to action or none.

**Not in this release:** turf legend, coverage %, GPX export, Health Connect, two-way sync, Stories
deep link, web turf map, admin.

### Size and native impact (Now and Next)

| Item                                                                                       | Size | Native build?             | Risk                                                                                                     |
| ------------------------------------------------------------------------------------------ | ---- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Real-auth remainder: no-account start, retire device tokens, hide mock profiles in release | S–M  | No (JS)                   | The app keys everything to a profile id (one SQLite database per profile; the background task reads it)  |
| Privacy policy and terms (site) + in-app link                                              | S    | No                        | Legal wording; must match the data-flow table                                                            |
| In-app feedback with a user-approved, non-spatial summary                                  | S    | No                        | Must never include coordinates or places                                                                 |
| Gap estimation off by default                                                              | S    | No                        | Existing users keep their choice or not: decide                                                          |
| Polish native strings (L10)                                                                | S    | **Yes**                   | Ride the v0.16.0 binary or wait for the next one                                                         |
| TestFlight distribution                                                                    | —    | **Yes**                   | Blocked on the developer account (decision 3)                                                            |
| GPX export in the app (Next)                                                               | S    | No, after v0.16.0's build | —                                                                                                        |
| Turf legend (Next)                                                                         | S    | No                        | —                                                                                                        |
| Android public release (Next or Later)                                                     | L    | Yes                       | No real-phone run; Play background-location video and declarations; `RECEIVE_BOOT_COMPLETED` unjustified |
| Two-way sync (Later)                                                                       | L    | No                        | Conflicts and tombstones on the phone; A10 has no evidence                                               |

**v0.16.0 native impact.** `expo-file-system`, `expo-sharing`, `expo-image-picker`,
`react-native-view-shot` and two config plugins are new since v0.15.0, so testers need a new iOS
build and Android APK; it can't ship over the air. `apps/mobile/app.json` says 0.16.0 since the
release commit `caafd6e` (2026-11-13).

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

| #   | Decision                                               | Recommendation                                                                                                                                                                              | Trade-off                                                                                       |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Beachhead now that Health import only goes forward     | Keep beachhead 1; drop "day-one wow" from positioning and test glow on return (A1) instead                                                                                                  | A limited back-import (e.g. last 90 days) would restore the wow but reverse the 2026-11-05 call |
| 2   | Use without an account (B1) in the next release        | Yes, first item: the privacy promise and Apple 5.1.1 both depend on it, and A5 can't be tested without it                                                                                   | About a week; a third identity path beside account and mock profiles                            |
| 3   | Apple Developer enrolment as an organisation (D-U-N-S) | Start now: longest lead time; blocks TestFlight, which blocks any stranger cohort                                                                                                           | US$99 a year; DSA trader details published                                                      |
| 4   | Native release path for v0.16.0                        | One native build carrying Share photo **and** the Polish permission strings (L10), installed on the iPhone and as an APK; mark Android "preview"; then OTA for GPX and the no-account start | Holding v0.16.0 a few days for L10 vs two native builds in a row                                |
| 5   | Two-way sync vs launch blockers                        | Launch blockers first (no-account start, privacy policy, TestFlight). Two-way sync (L) waits until A10 has any evidence; restore already covers a new phone                                 | A Turfer with two phones sees only one phone's turf                                             |
| 6   | Recruiting while the waitlist is hidden                | One waitlist call to action in the hero (fixing the `#waitlist` link), with the optional "Walk, run or ride?" question if Brevo allows; meanwhile recruit 5 interviewees by hand            | The page is a little less minimal                                                               |
| 7   | Android                                                | "Preview" everywhere until one real-phone field test passes A3; no Android-only work                                                                                                        | Android is about two-thirds of Polish phones                                                    |
| 8   | Gap-estimation default                                 | Off by default (opt-in)                                                                                                                                                                     | Dashed gaps for testers who don't turn it on                                                    |
| 9   | Discovery before Next bets                             | Daily goal and Share photo were built on founder requests with no evidence; run 5 non-friend interviews before shaping any Next item                                                        | Slower Next; fewer wasted builds                                                                |
| 10  | This doc                                               | Accept, edit or reject §4–§5; accepted sections make it canonical                                                                                                                           | —                                                                                               |
