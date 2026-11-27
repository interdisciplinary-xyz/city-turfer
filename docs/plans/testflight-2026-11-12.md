---
status: proposed
verified: 2026-11-12
owner: founder
scope:
  [
    apps/mobile/app.json,
    apps/mobile/eas.json,
    apps/mobile/src/contexts/identity,
    apps/mobile/src/contexts/cloud-backup,
    apps/mobile/src/dev,
    apps/mobile/e2e,
    apps/web/src/app,
    docs/operations,
  ]
summary: >-
  First iOS release through TestFlight: Apple account and app record, the EAS store build, a release
  gate on a real iPhone, an internal ring from scope/v0.17.0, strangers only on the v0.17.0 release
  after the privacy policy, no-account start and hidden mock profiles.
---

# First TestFlight release

Written by the team on 2026-11-12: `rn-architect` (build and signing), `product-manager` (scope and
testers), `qa-engineer` (release gate), `brand-designer` (copy and assets), `api-engineer` (server
and personal data). Everything below was read from the repo; nothing was built, uploaded or checked
on Apple's, Vercel's or Neon's side.

## 1. The plan in one paragraph

Ship **a build from scope/v0.17.0 to internal TestFlight** (the founder and up to three trusted
people, no Apple review) as soon as the paid Apple Developer account exists. (v0.16.0 was released
on 2026-11-13 before any of this was ready, so build 1 comes from the next scope.) That build proves
the pipeline: store signing, background GPS on a store-signed binary, Health, upgrades and OTA
updates. **Strangers get v0.17.0 "first strangers"** (`docs/product/feature-scope.md` §4) through
**external testing by e-mail invite**, after the privacy policy, the no-account start, hidden mock
profiles and gap-estimation off by default have shipped. A capped public link comes last.

## 2. Where we are

| Area            | State today                                                                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple account   | Builds are signed with a **free Apple ID** and expire after 7 days (`docs/operations/runbook.md` #7). TestFlight needs a paid Developer Program membership for team `KD9S2F8UCY`, an App Store Connect (ASC) app record and an ASC API key                                         |
| Bundle id       | `com.turftrack.poc` when written; **superseded by T2**: `com.cityturfer.app` since #236 (Android keeps `com.turftrack.poc`)                                                                                                                                                        |
| EAS             | `apps/mobile/eas.json` has only `android-apk`; no iOS store profile, no `submit` config. `appVersionSource: remote`                                                                                                                                                                |
| Version         | v0.16.0 released; `app.json` says 0.16.0, the packages 0.17.0; runtime version = fingerprint                                                                                                                                                                                       |
| App env         | `EXPO_PUBLIC_APP_ENV` is set for the APK but **no code reads it**; only `__DEV__` separates dev from release                                                                                                                                                                       |
| Sign-in         | A sign-in wall in front of the app (`apps/mobile/src/app/sign-in.tsx`). Any e-mail gets a 6-digit code and a real API account (`ApiAuthGateway`). The local `admin@` / `demo@` profiles open with passwords hard-coded in `mock-auth-gateway.ts`, in every build                   |
| Cloud backup    | Opt-in, needs a real account. A mock profile can only link to backup through a code sent to its own address, so testers cannot write into the founder's account                                                                                                                    |
| Dev tools       | Demo seeding runs on sign-in for `demo@` (`apps/mobile/src/ui-kit/app-context.tsx`); the seeder unlocks by tapping the version (`apps/mobile/src/app/info.tsx`); `apps/mobile/src/dev` ships                                                                                       |
| Native          | Background location (`UIBackgroundModes: location`), HealthKit (no background delivery, no clinical), background-session module (no extra entitlement), scene-lifecycle plugin. MapLibre's local SPM vendor folder is gitignored, so an EAS cloud build uses normal SPM            |
| Purpose strings | All needed ones present (location when-in-use and always, Health share and update, camera, photo-library add); none in Polish (no `expo.locales`). Prebuild generates `ios/CityTurfer/PrivacyInfo.xcprivacy` (UserDefaults, file timestamps, boot time); libraries bring their own |
| Icon and splash | Ready: `apps/mobile/assets/icon.png` 1024², no alpha (from `render-assets.mjs`); splash on `#0B0D12`                                                                                                                                                                               |
| Privacy policy  | **None.** `apps/web` has no privacy page                                                                                                                                                                                                                                           |
| Production API  | Vercel `city-turfer-api` + Neon, both Frankfurt. Not recorded whether migrations 0004–0006, `WEB_EDGE_SECRET`, `WEB_ORIGIN` and the turf backfill are on production (`docs/operations/api-deploy.md`). No uptime check or alerts. `API_TOKENS` device-token path still live        |

## 3. Decisions for the founder

| #   | Decision                                                                              | Recommendation                                                                                                                                                                                                                                    | Blocks                  |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| T1  | Developer account: individual or organisation (**not enrolled yet**, 2026-11-15)      | Organisation, since the company is Interdisciplinary sp. z o.o. and the seller name should be the company (needs a D-U-N-S number; start now, it takes days to weeks); individual if your own name as seller is fine. Same as feature-scope §6 #3 | Everything              |
| T2  | Final iOS bundle id and App Store name (**decided 2026-11-15: `com.cityturfer.app`**) | `com.cityturfer.app`, "CityTurfer". Android keeps `com.turftrack.poc` (a new id there is a new app for APK users). Reserve the name in ASC early; quick trademark check against Turf (turfgame.com)                                               | Creating the ASC record |
| T3  | Cloud backup in build 1                                                               | Keep it (it is already opt-in and off by default, and it is how your recordings move to the new bundle id) **only after** the production checks in §5 Phase 1; otherwise hide it for build 1                                                      | Build 1 content         |
| T4  | Who may publish `production` OTA updates                                              | The founder only, after the release gate; testers get every iOS OTA on that channel with no Apple review                                                                                                                                          | Build 1                 |
| T5  | Feedback inbox                                                                        | The `NEXT_PUBLIC_CONTACT_EMAIL` inbox; ASC requires a feedback e-mail                                                                                                                                                                             | ASC test information    |
| T6  | Ring 1 success criteria                                                               | The exit criteria in §6, written on `docs/product/discovery-board.md` before invites go out                                                                                                                                                       | Ring 1                  |
| T7  | Android in the beta cohort                                                            | No: iPhone only, noted as a bias                                                                                                                                                                                                                  | Recruiting              |

Feature-scope §6 decisions that block strangers (not build 1): **#2** use without an account, **#8**
gap estimation off by default, **#6** recruiting channel. **#4** native path decides whether the
Polish permission strings ride build 1 (recommended: yes, one native build).

## 4. Rings

| Ring          | Who                                                                                        | n     | Build              | Exit criterion                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------ | ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 0 Internal    | Founder + up to 3 trusted people as ASC users                                              | 1–4   | scope/v0.17.0 head | Release gate (§7) passes on the TestFlight binary; ≥10 outings, 0 lost activities; data survives a build-to-build update |
| 1 External    | Beachhead strangers: iPhone (Watch ideally), ≥2 outings a week, a Polish city, not friends | ~8    | v0.17.0            | 3 weeks done; ≥6/8 record in week 1; 0 data-loss incidents; diaries and hallway tests logged                             |
| 2 Public link | Waitlist and communities, link capped                                                      | 30–50 | v0.17.x            | Ring 1 passes                                                                                                            |

External rings need Beta App Review: privacy policy URL, feedback e-mail, Beta App Description,
review notes and sign-in details for the reviewer (a real e-mail account they can receive codes for,
or the no-account start once #2 ships; not the Gdańsk demo profile, which shows fake data).

## 5. Phases

### Phase 0 — Apple side (founder, 1–14 days, mostly waiting)

- [ ] Enrol in the Apple Developer Program (T1).
- [x] Decide T2 (`com.cityturfer.app`, 2026-11-15).
- [ ] Register the App ID with HealthKit; create the ASC app record.
- [ ] Create an ASC API key for EAS submit (stored in EAS, never in the repo).
- [ ] Add ring-0 people as ASC users (internal testers).

### Phase 1 — Build path (engineering, about 2–4 days after Phase 0)

- [ ] `rn-architect` / `mobile-ui-engineer`: change `ios.bundleIdentifier` (T2). Update `appId` in
      the Maestro flows (`apps/mobile/e2e`, `apps/mobile/e2e/run.sh`),
      `apps/mobile/tools/device-diagnose.sh`, `apps/mobile/tools/e2e/gpx-to-travel.mjs`, the runbook
      and the skills. Native change: new fingerprint.
- [ ] Add the iOS store profile and submit config to `eas.json`:

  ```json
  "ios-store": {
    "channel": "production",
    "distribution": "store",
    "environment": "production",
    "autoIncrement": true,
    "env": { "EXPO_PUBLIC_APP_ENV": "production" }
  }
  "submit": { "ios-store": { "ios": { "ascAppId": "<from ASC>", "appleTeamId": "KD9S2F8UCY" } } }
  ```

  Leave `EXPO_PUBLIC_API_URL` unset (defaults to `https://city-turfer-api.vercel.app`).

- [x] Privacy manifest: checked 2026-11-15, prebuild generates one (see §2). Confirm ASC processing
      shows no ITMS-91053 warning; confirm the built Info.plist has no stray photo-library read or
      motion key. Watch build 1 for **ITMS-90683 on `NSMotionUsageDescription`**: expo-location
      links `CMMotionActivityManager` even though the app never calls it
      (`motionUsagePermission: false` in `app.json`, PR #235 review). If ASC flags it, replace
      `"motionUsagePermission": false` in the `expo-location` plugin of `app.json` with a truthful
      text ("CityTurfer doesn't use motion and fitness data; it records your route from location
      only."). `false` makes the plugin delete the key at prebuild, so an `infoPlist` entry alone is
      lost. Add `NSMotionUsageDescription` to `apps/mobile/locales/pl.json` too. No prompt appears,
      because the API is never called. This changes the fingerprint.
- [ ] `brand-designer` + `mobile-ui-engineer`: Polish purpose strings (`expo.locales.pl`, §8) and
      the sharper when-in-use string, if decision #4 says build 1 carries them.
- [ ] `api-engineer` + founder, if T3 keeps backup: confirm production `GET /v1/health` answers
      `database: ok` on 0.6.x (migrations ≤ 0006), set `WEB_EDGE_SECRET` / `WEB_ORIGIN`, run the
      turf backfill, choose Neon's restore window, remove `API_TOKENS`, run the client-IP checks,
      add an uptime check on `/v1/health` and alerts on 5xx and on the 03:00 UTC retention cron.
- [ ] Build 1 (internal only) from the scope/v0.17.0 head once the TestFlight branch has merged,
      with `app.json`'s version and EAS build numbers; external builds come from the tagged v0.17.0
      release commit. Build on EAS cloud (`eas build -p ios --profile ios-store`), record the
      fingerprint in the session log, submit (`eas submit -p ios --profile ios-store`). First cloud
      build risks: MapLibre SPM, the scene plugin's AppDelegate regex on EAS's template, processing
      warnings (ITMS) for the privacy manifest, HealthKit and background modes.

### Phase 2 — Ring 0 (scope/v0.17.0 builds, 2–3 weeks)

- [ ] Release gate (§7) on the TestFlight binary; fix blockers; new build per fix.
- [x] Founder moves own recordings to the new bundle id. Done 2026-11-25 by a direct copy (both apps
      were development builds, so `devicectl` can read and write their data containers): with the
      founder's OK, both apps closed, the old app's `Documents/SQLite` was copied to the Mac,
      checked (`PRAGMA integrity_check`, counts per table) and copied into the empty new app; after
      the founder signed in, the new app's copy matched table by table (49 activities), and only
      then was `com.turftrack.poc` uninstalled. Copies: `~/ct-phone/migration-2026-11-25/`. For
      anyone else still on the old id, the cloud route below works on any build. Keep the old
      `com.turftrack.poc` app (re-sign it from tag `v0.16.0` if its 7-day signature expired; same
      id, so its data stays) and never delete it before the last step passes:
  1. In the old app, turn on Cloud backup **and "Include Apple Health workouts"**. Without the
     toggle, Health-imported activities (`hk-` ids) never reach the backup, and the new app can't
     import them again (it only takes workouts that end after its own connection).
  2. Keep the old app open until, after a run that finished after you turned the Health switch on,
     Info › Cloud backup reads "Backed up N of N activities · last run …", with no "can't be backed
     up" line and no error. The card shows no queue; that line is the signal. If any activity is
     refused (too long or unreadable), it can't move: keep the old app.
  3. Sign in on the new app with the same account and restore in one go (no interruption).
  4. Compare that N with the new app's "Restored N activities." and look at the turf. The two Ns
     already cover Health imports: with the switch on, "Backed up N of N" counts the `hk-`
     activities, and "Restored N" counts everything in the backup. For a count of `hk-` ids only
     (copies data off the phone, so only with the founder's OK):
     `apps/mobile/tools/device-diagnose.sh` cannot show it; copy the database, then
     `sqlite3 ~/ct-phone/<bundle id>/turftrack-admin.db "SELECT count(*) FROM log_activities WHERE id LIKE 'hk-%'"`.
- [ ] Ring-0 testers get the "What to Test" text (§8) and the tester brief.

### Phase 3 — Before strangers (v0.17.0)

Hard blockers:

- [ ] Use without an account (feature-scope §6 #2; Apple 5.1.1).
- [ ] Mock profiles and their passwords, and the developer-tools unlock
      (`apps/mobile/src/app/info.tsx`), out of store builds. The "store build" signal must survive
      OTA updates: an `EXPO_PUBLIC_*` value set only in the `eas.json` build profile is missing from
      a bundle published with `eas update`, so set it as an EAS environment variable (used by both)
      or read a native value.
- [ ] Privacy policy and terms, EN and PL, at `/[locale]/privacy` on the website (`web-engineer`,
      text approved by the founder), linked in the app before the first location prompt.
- [ ] Gap estimation off by default (§6 #8).
- [ ] App Privacy questionnaire in ASC (§9).
- [ ] Production checks from Phase 1 done whether or not build 1 had backup; DPAs signed with
      Vercel, Neon and Brevo (SPF/DKIM on Brevo sending); a short pre-DPIA note on location
      tracking.
- [ ] Account deletion tested against production (`DELETE /v1/me`).

Nice-to-haves: in-app feedback with a stats summary the tester reviews (TestFlight feedback + mailto
is enough for ring 1), empty states on a fresh install, the app working with location denied, turf
legend.

### Phase 4 — Ring 1, then ring 2

- [ ] Fill test information in ASC; submit for Beta App Review.
- [ ] Invite ~8 by e-mail; 3 weeks; diary after each outing; 15-minute end call.
- [ ] Check ring 1's exit criteria; then open a public link capped at 50.

## 6. What we learn (no coordinates)

1. Do they come back unprompted? ≥3 activities in weeks 2–4 (self-report or a reviewed summary;
   TestFlight session counts as a cross-check).
2. Do they trust the recording? Incidents per 10 activities, from reports and crash logs.
3. Do they read the map? ≥4/5 hallway tests find "your streets" and "most visited" unaided.
4. Does the glow pull them out? ≥5/8 diaries name turf or glow as a reason to go out.
5. Does "no account" matter? End-call question; whether they turned backup on (self-reported).

## 7. Release gate (every build that goes to testers)

Automated, on the exact commit uploaded:

- [ ] `pnpm run check:secret-files -- --tracked && TURBO_FORCE=true pnpm run ci:quality` green; Jest
      and tool test counts recorded.
- [ ] `pnpm run e2e:audit` clean; `pnpm run test:e2e` passes all flows, once against an installed
      Release simulator build (not the dev client).
- [ ] `pnpm test:chain` green when backup ships.
- [ ] iOS fingerprint (`expo-updates fingerprint:generate --platform ios`) recorded in the PR.
- [ ] ASC processing shows no ITMS warnings.

On a real iPhone, with the TestFlight-installed binary:

- [ ] Smoke test sections 0–9 (`docs/quality/smoke-test.md`).
- [ ] Field protocol. Reference distance from `route-stats.mjs` on a pre-drawn route; read the
      timeline with `device-diagnose.sh` (no coordinates); **ask the founder before copying any data
      off the phone**.
  - A. 60+ min, phone locked in a pocket: distance within ±5%, no gap over 45 s outside tunnels, no
    estimated dashes on walked streets, turf along the whole corridor, timer = wall clock − pauses.
  - B. App swiped away at minute 10, 5 more minutes, reopen: one activity, points before and after,
    timer not reset.
  - C. Low Power Mode 20 min: within ±10%, gaps shown as gaps.
  - D. Permission downgraded to "While Using" mid-recording: the app says so, recovers or shows a
    clear gap, no crash.
  - E. Airplane mode 10 min with backup on: recording continues, the queue uploads afterwards, the
    portal matches the phone.
  - F. Battery drop per hour noted (target to be set by `product-manager`).
- [ ] Apple Health import (incl. an Apple Watch workout), export and re-import without duplicates,
      access off shows the empty state.
- [ ] Share photo: camera prompt and Deny, Save Image, Instagram and WhatsApp; no map on the card.
- [ ] Cloud backup off by default; nothing uploaded before consent; "Include Apple Health workouts"
      off by default.
- [ ] Polish: plurals 1/2–4/5+, no truncation.
- [ ] Clean install: prompts in the right order, empty states, demo seeder hidden.
- [ ] Upgrade build N → N+1 from TestFlight without deleting the app: activities, turf, goals,
      consent and language intact.
- [ ] OTA to the build's channel: after a cold start Me › Info shows the update id; data intact.
- [ ] Release-only behaviour: no dev menu or LogBox, `__DEV__` code gone, API URL is production.

Triage during the beta:

- **Blocker** (stops the rollout to external testers; roll back the OTA or expire the build): a lost
  or altered recording, data lost on upgrade or OTA, personal data leaked, crash on launch, a
  background gap over 2 min with "Always" on.
- **Major** (fix before the next external build): a broken feature, phone/API/portal disagree.
- **Minor**: wording and layout, batched.
- Every bug gets a fixture and a failing test first. Crashes read daily in Xcode Organizer (dSYMs
  uploaded) and ASC › TestFlight › Crashes. There is no remote telemetry; diagnostics stay on the
  phone. Keep coordinates and e-mail addresses out of issues.

## 8. Copy (to approve)

**Beta App Description:** CityTurfer records your walks, runs and rides on a real map. Every street
you cover becomes your turf, and it glows brighter each time you come back. Your routes stay on your
phone; cloud backup is off until you turn it on.

**What to Test (build 1):** Record a walk, run or ride with the screen locked, then check the route
and stats. Open the Turf Map and see what you've claimed. Optional: import from Apple Health, share
a photo card. Tell us when something is confusing, a route has gaps, or the battery drains. Before
you send a screenshot of your map, check you're happy to show those streets.

**Tester brief outline:** what it is · what leaves the phone · how to install · three tasks · diary
prompt after each outing ("why did you go out?") · how to report a bug · how to delete everything
(deleting the app deletes local data) · dates and the end call.

**Purpose strings** (EN · PL):

- Location when in use (replace the current one): "Shows where you are and records your route while
  you walk, run or ride, so every street you cover becomes your turf." · "Pokazuje, gdzie jesteś, i
  zapisuje trasę podczas spaceru, biegu lub przejażdżki, by każda pokonana ulica stała się Twoim
  terytorium."
- Location always (keep EN) · "Zapisuje trasę podczas spaceru, biegu lub przejażdżki, także przy
  wygaszonym ekranie, by każda pokonana ulica stała się Twoim terytorium."
- Health read (keep EN) · "Importuje Twoje spacery, biegi, wędrówki i przejażdżki z trasami, by
  liczyły się do Twojego terytorium."
- Health write (keep EN) · "Zapisuje nagrane spacery, biegi i przejażdżki w Apple Health jako
  treningi z trasami."
- Camera (keep EN) · "Aparat służy do zrobienia zdjęcia na kartę aktywności. Zdjęcie zostaje na
  telefonie, dopóki go nie udostępnisz."
- Photo library add (keep EN) · "Zapisuje kartę aktywności w Zdjęciach, gdy wybierzesz Zachowaj
  obraz."

Polish needs `"locales": { "pl": "./locales/pl.json" }` and `CFBundleAllowMixedLocalizations` in
`app.json` (native rebuild).

## 9. App Privacy answers (ASC)

- **Build without backup:** probably "Data Not Collected" (map tiles and gap routing count as
  real-time servicing). Check against Apple's definitions when filling it in.
- **With backup:** Precise Location, Health & Fitness, Email Address, User ID, all linked to the
  user, app functionality only. No diagnostics, no tracking, no advertising.
- HealthKit data reaches the server only when "Include Apple Health workouts" is on; never used for
  ads or analytics; HealthKit only in the foreground. Open: whether Health data may sit in the
  iCloud device backup (guideline 5.1.3).

## 10. Owners and effort

| Work                                                | Owner                                     | Effort                   |
| --------------------------------------------------- | ----------------------------------------- | ------------------------ |
| Apple account, ASC record, API key, decisions T1–T7 | founder                                   | days to weeks of waiting |
| Bundle id, EAS profile, Polish purpose strings      | `rn-architect`, `mobile-ui-engineer`      | 1.5–2 days               |
| First cloud build and submit                        | `rn-architect`                            | 0.5–1 day                |
| Production checks, monitoring, `API_TOKENS` removal | `api-engineer` + founder                  | 1–2 days                 |
| Polish purpose strings, copy                        | `brand-designer`                          | 0.5 day                  |
| Release gate and field protocol                     | `qa-engineer` + founder (device, walking) | 2–3 days per build       |
| Privacy policy page, terms                          | `web-engineer` + founder (legal text)     | 1–2 days + legal review  |
| No-account start, hide mock profiles, gap default   | per feature-scope §4 (v0.17.0)            | about a week             |

## 11. Not verified

- That an EAS cloud build of this app succeeds (MapLibre SPM, scene plugin) — first build will tell.
- That a Release build leaves out the `expo-dev-client` launcher.
- Production API state (migrations, env vars) — not recorded anywhere in the repo.
- That backup → restore moves everything to the new bundle id, including Health links.
- Whether ASC demands the privacy policy URL for internal testing or only for external.
