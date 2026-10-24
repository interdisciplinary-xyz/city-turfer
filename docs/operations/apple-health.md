---
status: canonical
verified: 2026-10-23
owner: founder
scope: [apps/mobile/src/contexts/health-sync, apps/mobile/e2e/11-apple-health.yaml]
summary: Install the Apple Health build on the iPhone and check import and export with real data
---

# Apple Health on the iPhone

The Simulator proves the code path; only the iPhone has your Apple Watch workouts. Design:
`docs/decisions/apple-health-2026-10-18.md`.

## Install

1. Apple Health came in a **native change** (new runtime fingerprint), so the phone needs a Release
   build that includes it: reinstall from Xcode over the existing app, as in #7 of
   `docs/operations/runbook.md`. Don't delete the app first: that would delete your activities.
2. If Xcode reports that the provisioning profile doesn't support HealthKit: Signing & Capabilities
   → let it re-sign once (free Apple ID works).

## Connect and import

1. Me → Info → **Apple Health** → **Connect Apple Health**.
2. Apple's sheet: **Select All** (or "Turn On All"), **Allow**. On iOS 26 choose **All Recorded Data
   and Future Data**, otherwise only the last 30 days import.
3. The import starts right away. The card shows "Importing… N added so far", then "Last import: N
   workouts added · M without a route". Years of workouts can take a few minutes; leaving the app is
   fine, it continues from where it stopped next time.
4. Check: History shows the workouts with "From Apple Health" on their detail screen, the Turf Map
   has their streets.

## Export

1. Record a short walk in CityTurfer and finish it.
2. Health app → Browse → Activity → Workouts: the walk is there, from CityTurfer, with a route map.
3. Open CityTurfer again: the next import must not bring that walk back (count stays the same).

## Cloud backup and restore

- Imported workouts reach the API only when Info › Cloud backup has **Include Apple Health
  workouts** on (iOS only). Without it they stay on the phone.
- A phone restored from the backup gets those workouts back (origin `restore`) and links them in
  `hs_links`, so the next Health import doesn't bring them in twice; one deleted after the restore
  stays deleted. A restore takes over only the cloud-sync consent: **Include Apple Health workouts**
  stays off on the restored phone until you turn it on there.

## If something is off

- **0 workouts:** Health app → Profile → Apps → CityTurfer: Workouts and Workout Routes allowed,
  data access "All Recorded Data".
- **Workouts without a route:** treadmill and indoor workouts have none, as do workouts from apps
  that don't share routes. They are skipped on purpose.
- **Stop syncing:** the card's Disconnect, or the two switches (Import workouts, Save recordings to
  Health). Revoking access happens in the Health app.

Tell Claude what you saw (counts, any errors) rather than copying app data off the phone.
