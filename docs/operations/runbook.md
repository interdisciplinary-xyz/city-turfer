---
status: canonical
verified: 2026-10-17
owner: founder
scope:
  [
    tools/device-diagnose.sh,
    tools/diagnose-recording.mjs,
    tools/fetch-maplibre-ios.sh,
    e2e/run.sh,
    src/platform/outbox.ts,
    src/platform/diagnostics.ts,
    app.json,
  ]
summary:
  Paste-and-run checklists for the incidents CityTurfer actually has — recording, outbox, OTA,
  builds, e2e, signing
---

# Runbook

CityTurfer's incident runbook, in the shape of empatalk's `RUNBOOK.md`. Seven incidents, roughly in
order of how often they happen. Each one is short on purpose: symptom, a triage you can paste, the
fix.

**First two minutes of any incident:**

1. On the phone: **Me → Info**. Note the update line: `Update <id> · <date> · production` is an OTA
   or embedded release build; "Development build (updates come from Metro)" means a dev build, and
   OTA incidents don't apply.
2. Decide **native or JS**. A change to `modules/`, `plugins/`, permissions, icons or `app.json`
   (its `version` too) needs a new build; anything else can ship as an OTA.
3. **Location data is personal data.** Never copy the app's database (or any location trace) off the
   founder's iPhone without asking first, never paste coordinates into an issue or a chat, and
   delete the copy (`~/ct-phone`) when done. The diagnostics below print no coordinates.

---

## #1 — Recording stops when the screen is off

**Symptom:** A real-device recording has bursts of points after each screen lock, then nothing until
unlock; the activity shows long dashed gaps (estimated along streets) and less turf than walked.

**Triage**

Ask the founder before copying the phone's data. Then, with the iPhone connected:

```bash
xcrun devicectl list devices                  # find the iPhone's identifier
tools/device-diagnose.sh <device-udid>        # copies Documents/SQLite to ~/ct-phone, prints the timeline
# Another session than the latest:
node tools/diagnose-recording.mjs ~/ct-phone/turftrack-admin.db --session <id>
```

The timeline (no coordinates) shows, minute by minute: location batches with their app state and
source, fixes received / accepted / rejected, worst accuracy, app-state changes, launches and task
errors. Each `launch` row records `locationAlways`, `preciseLocation`, `bgSessionAvailable`,
`liveStreaming` and `lowPowerMode` (`src/composition-root.ts`).

Reproduce on the simulator without a phone:

```bash
tools/sim-location.sh ios tools/fixtures/walk-2k.gpx    # replay movement into the booted simulator
# start a recording, background the app (Cmd+Shift+H) for ≥ 60 s, foreground it: the route must have no gap
tools/sim-location.sh ios --clear
```

**Fix**

- `locationAlways: false` or `preciseLocation: false`: iPhone Settings → CityTurfer → Location →
  **Always** and **Precise Location** on.
- `bgSessionAvailable: false` or `liveStreaming: false`: the installed binary predates the native
  module (`modules/background-session`). An OTA can't add native code: reinstall (incident #7).
- `lowPowerMode: true`: Low Power Mode throttles location; turn it off for recordings.
- Batches arrive but fixes are rejected: GPS accuracy worse than the profile's limit
  (`src/contexts/recording/domain/tracking-profile.ts`), typical near tall buildings. Working as
  intended.
- Already-recorded gaps: nothing to repair. Gaps over 45 s are separate segments, and their street
  estimates count distance but never turf.
- Done: `rm -rf ~/ct-phone`.

---

## #2 — Activity stuck on "Saving your activity…"

**Symptom:** After finishing a recording, the activity screen keeps showing "Saving your activity…";
the activity is missing from History, or its turf never appears.

Finishing writes the session and a `SessionFinished` event to `sys_outbox` in one transaction; the
`EventDispatcher` (`src/platform/outbox.ts`) then hands it to Activity Log, whose `ActivityRecorded`
event goes to Territory. A handler that throws leaves its event pending, and the dispatcher stops at
the **first** pending event, so everything after it waits too. Failures are only `console.warn`ed in
dev builds; they are not in `sys_diagnostics`.

**Triage**

```bash
# Simulator: the database lives in the app's data container
DB="$(xcrun simctl get_app_container booted com.turftrack.poc data)/Documents/SQLite/turftrack-admin.db"
# iPhone (ask first): tools/device-diagnose.sh <udid>, then DB=~/ct-phone/turftrack-admin.db
sqlite3 "$DB" "SELECT id, type, datetime(created_at/1000,'unixepoch','localtime') FROM sys_outbox
               WHERE processed_at IS NULL ORDER BY id;"
sqlite3 "$DB" "SELECT datetime(at/1000,'unixepoch','localtime'), kind, data FROM sys_diagnostics
               WHERE kind IN ('task-error','maintenance') ORDER BY at DESC LIMIT 20;"
```

Event payloads hold ids, activity types and timestamps, no coordinates.

**Fix**

1. Relaunch the app: the dispatcher retries every pending event on start (`getContainer()` in
   `src/composition-root.ts`). Most stuck saves are a launch that was killed mid-chain.
2. If the same event stays pending, its handler fails every time. Run the app from Metro
   (`pnpm start`) to see the `[outbox] handler failed for <type>` warning, then reproduce it in Jest
   (`src/__tests__/end-to-end.test.ts` drives the full chain on real SQL).
3. **Don't mark outbox rows processed by hand.** That skips the activity or its turf for good. Fix
   the handler and ship it (OTA if JS-only); the pending event is delivered on the next launch.
4. `fix/outbox-and-retention` (#30, in review) changes outbox handling; re-check this section after
   it merges.

---

## #3 — An OTA update doesn't reach the phone

**Symptom:** `eas update` succeeded, but Me → Info still shows the old update id.

**Triage**

```bash
pnpm dlx eas-cli@latest channel:view production                         # branch + runtime of the latest group
pnpm dlx eas-cli@latest update:list --branch production --limit 5       # recent groups and their runtime versions
pnpm exec expo-updates fingerprint:generate --platform ios               # this checkout's runtime fingerprint
```

`app.json` sets `runtimeVersion.policy: fingerprint`, channel `production`, and
`checkAutomatically: ON_LOAD` with `fallbackToCacheTimeout: 0`.

**Fix**

- **Runtime mismatch** (the update's runtime ≠ the installed build's): the update was built from a
  checkout whose native fingerprint differs — a native module, a config plugin, a permission, an
  icon, or `app.json` itself (its `version` included) changed. That update can never reach this
  binary. Publish from a checkout matching the installed build, or reinstall (incident #7).
- **Same runtime, old id on screen:** with `ON_LOAD` and a zero timeout the update downloads in the
  background and applies on the **next cold start**. Kill and reopen the app, or tap **Me → Info →
  Check for updates** (fetches and reloads).
- **Wrong channel:** the Info line must end in `production`, and the publish must use
  `--channel production` (README "Releases & OTA updates").
- **Dev build:** dev builds load JS from Metro, not OTA.

---

## #4 — A bad OTA update shipped

**Symptom:** After an OTA, the app crashes on launch or a feature broke for everyone on that
runtime.

**Triage**

```bash
pnpm dlx eas-cli@latest update:list --branch production --limit 5    # the bad group id and the last good one
pnpm dlx eas-cli@latest update:view <GROUP_ID>                       # details of one group
```

**Fix**

Roll back: republish the group published before the bad one (or the embedded update if there is
none). The bad group must be the latest on its branch and runtime.

```bash
pnpm dlx eas-cli@latest update:rollback <BAD_GROUP_ID> -m "Roll back <what broke>" --non-interactive
```

Or republish a specific known-good group:

```bash
pnpm dlx eas-cli@latest update:republish --group <GOOD_GROUP_ID> -m "Republish <id>: <why>" --non-interactive
```

Then the fix forward: revert the commit on the branch, and publish again once `pnpm run ci:quality`
passes:

```bash
pnpm dlx eas-cli@latest update --channel production --environment production --platform ios \
  --message "<what changed>" --non-interactive
```

Phones pick up the rollback like any update: on the next cold start, or via Check for updates. A
phone that crashes before it can check needs a reinstall.

---

## #5 — The iOS build hangs in Swift Package Manager

**Symptom:** `pnpm exec expo run:ios` (or Xcode) sits at "Resolving package graph" / downloading
MapLibre and never finishes.

**Triage**

```bash
cat vendor/maplibre-spm/.version 2>/dev/null || echo "MapLibre not vendored"
grep -n "with-local-maplibre" ios/Podfile    # the plugin's marker; missing = prebuilt without the plugin
xcodebuild -version                          # Expo SDK 57 needs Xcode 26.4+
```

**Fix**

```bash
tools/fetch-maplibre-ios.sh          # downloads MapLibre with curl into vendor/maplibre-spm (checksum-pinned)
pnpm exec expo prebuild --platform ios     # regenerates ios/; plugins/with-local-maplibre.js points SPM at the vendored copy
pnpm exec expo run:ios
```

`ios/` is generated (Continuous Native Generation): never fix it by hand; re-run prebuild.

---

## #6 — The Maestro suite fails on stale state or the iOS "Save Password" sheet

**Symptom:** `pnpm run test:e2e` fails early: a flow can't find the sign-in fields or finds old
activities, or it stops right after sign-in with iOS's "Save Password?" sheet on screen.

**Triage**

```bash
xcrun simctl list devices booted                     # exactly one booted simulator?
curl -fs http://127.0.0.1:8081/status && echo metro  # Metro running → flows open the dev build via DEV_URL
ls -t e2e-results | head -1                          # newest run: junit report + screenshots
```

**Fix**

- **Stale state:** `e2e/run.sh` wipes the app's SQLite files and the simulator keychain only for a
  full run or `01-auth` (Maestro's `clearState` doesn't remove them on the iOS 27 simulator). A
  single flow inherits whatever the last run left. Run the full suite, or `e2e/run.sh 01-auth`
  before the flow you're debugging.
- **Wrong build:** with Metro running, flows open the dev client through `DEV_URL`; to test the
  installed release build instead, stop Metro or run `DEV_URL= e2e/run.sh`.
- **Save Password sheet:** iOS offers to save the password after a successful sign-in, and the next
  step can't see the app under it. `chore/ci-quality-gates` (#28, in review) adds a
  `when: { visible: 'Not Now' }` tap to `e2e/subflows/sign-in.yaml` (commit `52e6a2f`). Until it
  merges, cherry-pick that commit onto your local branch before running the suite.

---

## #7 — The app won't open: free Apple ID signing expired

**Symptom:** The app on the iPhone closes immediately or iOS says it can't be verified. Builds
signed with a free Apple ID expire after 7 days; the current install expires **2026-10-23** (session
log v0.1.0).

**Triage**

```bash
xcrun devicectl list devices    # the iPhone is connected and trusted
```

**Fix**

Reinstall a Release build over the existing app. **Don't delete the app first**: deleting it deletes
its database, and with it every activity and all turf.

```bash
tools/fetch-maplibre-ios.sh                                     # once per machine (incident #5)
pnpm exec expo run:ios --configuration Release --device <device-udid>
```

A reinstall is also the moment for anything that changes the runtime fingerprint (pending native
changes, the `app.json` version pin). After it, OTAs must be published from a checkout with the new
fingerprint (incident #3).
