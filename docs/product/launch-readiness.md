---
status: canonical
verified: 2026-10-20
owner: founder
scope: [apps/mobile/app.json, apps/web/src/app, apps/mobile/src/app/sign-in.tsx]
summary:
  What stands between CityTurfer and a public App Store / Google Play launch — store, privacy and
  legal blockers in order, with today's status and sources (research 2026-10-20)
---

# Launch readiness

Canonical for: the public-launch checklist and where each item stands. How to work through it is in
the `product-launch` skill. Store rules change: re-check an item's source before acting on it. 🔴
blocks a public launch · 🟡 before or at launch · 🟢 nice to have · ❓ not confirmed from a primary
source.

## Today in one line

Not launchable on either store: no developer accounts, a mock login wall, no privacy policy or
terms, no privacy manifest, and store declarations not started. Distribution today is the founder's
iPhone (free Apple ID) and a sideloaded Android APK.

## Blockers, in the order to do them

| #   | Item                                                                                                                                                                                                                                        | Status today                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | 🔴 D-U-N-S number → **organization** accounts at Apple (US$99/yr) and Google; declare EU **DSA trader** status with company address/phone/email                                                                                             | Not started. Decision in `NOTEBOOK.md` (RELEASE)                        |
| 2   | 🔴 **Remove the mock login** (Apple 5.1.1(v): no login without account-based features; 2.1 needs demo credentials). No accounts → no deletion duty                                                                                          | Mock sign-in is the first screen (`apps/mobile/src/app/sign-in.tsx`)    |
| 3   | 🔴 **Privacy policy + terms (regulamin)**, PL and EN, on the website, linked in-app and in both consoles                                                                                                                                    | None. Website has only the waitlist note                                |
| 4   | 🔴 Decide **gap routing** (FOSSGIS logs requests; usage terms ❓): confirm terms, self-host, or explicit opt-in default off                                                                                                                 | Opt-out switch on Info, unset = on                                      |
| 5   | 🔴 iOS **privacy manifest** (`ios.privacyManifests` in app.json, required-reason APIs, `NSPrivacyTracking=false`); check MapLibre/HealthKit SDKs                                                                                            | Not configured                                                          |
| 6   | 🔴 **HealthKit 5.1.3**: no Health data in iCloud — decide whether the SQLite file is excluded from device backup (losing history on phone change)                                                                                           | Undecided ❓ (gray area). Write a decision record                       |
| 7   | 🔴 App Privacy label + age-rating questionnaire. "Data Not Collected" only if tiles/routing count as real-time servicing; else Location, not linked                                                                                         | Not started                                                             |
| 8   | 🟡 TestFlight external beta (Beta App Review on first build; 90-day builds; up to 10,000 testers)                                                                                                                                           | Blocked on #1                                                           |
| 9   | 🔴 Google Play: target **API 36** (from 2026-08-31); background-location declaration + ~30 s video with prominent disclosure **before** the prompt; `location` foreground-service declaration + video; Data safety; Health apps declaration | Not started. App has no prominent background-location disclosure screen |
| 10  | 🔴 Play **closed test**: 12 testers × 14 days if the account is personal (organization accounts exempt)                                                                                                                                     | Depends on #1                                                           |
| 11  | 🟡 Justify or drop `RECEIVE_BOOT_COMPLETED` (expect reviewer questions)                                                                                                                                                                     | Declared in `apps/mobile/app.json`                                      |
| 12  | 🟡 Pre-DPIA note (Polish UODO list names location tracking); Brevo DPA and stored consent proof                                                                                                                                             | Not written                                                             |
| 13  | 🟡 Register the Android package for **developer verification** (global rollout 2027+) — affects the sideloaded APK too                                                                                                                      | Not started                                                             |
| 14  | 🟡 App works with location denied (Apple 5.1.2(i)): history, Turf Map, Health import still usable; useful empty state on a fresh install (4.2)                                                                                              | To verify on device                                                     |
| 15  | 🟡 Store listings PL + EN: name/subtitle 30, keywords 100 bytes (Polish diacritics are 2 bytes), promo 170; screenshots lead with the Turf Map; category Health & Fitness                                                                   | Draft keywords only (`brand-system` skill)                              |
| 16  | 🟢 Rating prompt after a positive moment (first claimed street, a tier up) — max 3 per 365 days on iOS                                                                                                                                      | Not built                                                               |
| 17  | 🟢 App i18n (PL) — the website already redirects Polish browsers to `/pl`                                                                                                                                                                   | In-app copy EN + PL (v0.10.0); iOS permission prompts still English     |

## What leaves the phone today (for the policy and labels)

| Flow                      | Data                                                                                                                                         | To                           | Note                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| Map tiles                 | Tile coordinates of the viewed area + IP                                                                                                     | OpenFreeMap                  | Attribution required; no SLA                             |
| Gap estimation (optional) | Two endpoints of each GPS gap + IP + UA                                                                                                      | routing.openstreetmap.de     | Logged by the operator; 1 req/s; skipped near start/end  |
| Update check              | App/runtime version + IP                                                                                                                     | EAS Update (Expo)            | —                                                        |
| Waitlist (website)        | Email + consent                                                                                                                              | Brevo (EU)                   | Double opt-in                                            |
| Website hosting           | IP, request                                                                                                                                  | Vercel                       | Public pages: no cookies; portal: 1 session cookie       |
| Cloud backup (opt-in)     | Activities with full tracks, names, times, time zone, gap routes, Home City id; Apple Health imports only with a second switch; device token | CityTurfer API (Vercel fra1) | Consent with policy version; one-way; never demo history |

Without Cloud backup, routes, turf and Apple Health data stay in the on-device SQLite database. The
v0.8.0 phone client (Info › Cloud backup, `apps/mobile/src/contexts/cloud-backup`) uploads tracks to
the API (`docs/decisions/api-sync-2026-10-20.md`) once the user pastes a device token and turns it
on — before that ships beyond the founder, the policy, App Privacy label (Location, linked to the
user), Data safety form, account deletion (Apple 5.1.1(v)) and DPIA all change.

## Learning without analytics at launch

Launch with store-side analytics only (App Store Connect opt-in cohorts, Play vitals), TestFlight
feedback and an in-app mailto. Later, if needed: an **opt-in** EU tool (e.g. Aptabase) with a short
event whitelist — no coordinates, no H3 cell ids, no city names — and update the labels to "Data Not
Linked to You". See the `product-discovery` skill.

## Sources

Apple: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) ·
[App privacy details](https://developer.apple.com/app-store/app-privacy-details/) ·
[Required reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
· [Enrollment](https://developer.apple.com/programs/enroll/) ·
[DSA trader](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
·
[TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)
· [Review prompts](https://developer.apple.com/documentation/storekit/requesting-app-store-reviews)

Google:
[Closed testing for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
·
[Background location](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en)
·
[Foreground service types](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en)
· [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) ·
[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) ·
[Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en)
· [Developer verification](https://developer.android.com/developer-verification)

EU/PL:
[EDPB guidelines 1/2024](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf)
·
[UODO DPIA list summary](https://odo24.pl/blog-post.uodo-opublikowal-nowy-wykaz-rodzajow-operacji-przetwarzania-wymagajacych-dpia)
· [UŚUDE text](https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU20241441513/O/D20241513.pdf) ·
[FOSSGIS routing](https://routing.openstreetmap.de/about.html) ·
[OpenFreeMap](https://openfreemap.org/)

Not confirmed: FOSSGIS production-use terms, whether a device backup counts as "iCloud storage"
under 5.1.3, exact App Store name/subtitle limits, Play DSA trader form, current UODO list.
