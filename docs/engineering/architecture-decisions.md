---
status: canonical
verified: 2026-10-23
owner: founder
scope:
  [
    apps/mobile/.dependency-cruiser.cjs,
    apps/mobile/src/platform,
    apps/mobile/src/contexts,
    apps/mobile/modules/background-session,
    apps/mobile/app.json,
    docs/process/release-manager.md,
  ]
summary:
  Why CityTurfer is built the way it is — one entry per decision, newest first, with status and
  trade-off
---

# Architecture decisions

Key decisions and their rationale, so contributors (and agents) know why things are built the way
they are before changing them. Format adapted from empatalk's `ARCHITECTURE_DECISIONS.md`: one
`## Why … (date)` entry per decision, newest first, each with **Status**, **Decision**,
**Rationale** and **Trade-off**. A replaced decision keeps its entry under a ⚠️ superseded banner.
Decisions big enough for a full write-up get a record in `docs/decisions/` and a short entry here.

The dated entries from the PoC plan's decisions log (`docs/poc-plan.md` §9) live here now. Later
decisions with a full record (API, sync, accounts, web portal, brand, Apple Health, monorepo) are in
`docs/decisions/`, listed in `docs/INDEX.md`; only the ones that change how the app itself is built
have an entry here.

---

## Why the app's languages ship over the air (2026-10-23)

**Status:** Accepted, shipped in v0.10.0 (#158). Full record:
[`decisions/mobile-i18n-2026-10-23.md`](../decisions/mobile-i18n-2026-10-23.md).

**Decision:** English and Polish through `use-intl`, catalogue in
`apps/mobile/messages/<locale>/<namespace>.json`, language from Info › Language (System, English,
Polski) else the phone. Core takes its words from the caller (default activity names, city search),
so `packages/core` stays free of copy. Checked by `pnpm run audit:i18n` and a no-raw-text lint rule.

**Rationale:** JS only, so the languages reach installed phones by OTA.

**Trade-off:** iOS permission prompts and the app's language in iOS Settings need native strings: a
later binary release (L10).

---

## Why the brand typefaces are bundled in the binary (2026-10-22)

**Status:** Accepted, shipped in v0.10.0 (#140). Full record:
[`decisions/brand-typography-2026-10-22.md`](../decisions/brand-typography-2026-10-22.md).

**Decision:** Big Shoulders Display and Barlow Semi Condensed are embedded with the `expo-font`
config plugin (`apps/mobile/app.json`, files in `packages/brand/fonts/`), not loaded at runtime.

**Rationale:** Headings and numbers render in the brand face from the first frame, with no network
and no flash of a fallback font.

**Trade-off:** `app.json` changed, so the runtime fingerprint changed: v0.10.0 is a native release,
and a phone needs a new build (after `expo prebuild --clean`, `docs/operations/runbook.md`) before
OTAs reach it.

---

## Why the server runs the phone's turf rules (2026-10-23)

**Status:** Accepted, shipped in v0.10.0 (#149, API contract 0.6.0). Full record:
[`decisions/api-server-turf-2026-10-23.md`](../decisions/api-server-turf-2026-10-23.md).

**Decision:** The API derives turf from uploaded tracks with the same use cases from
`@cityturfer/core/territory` and the same H3 adapter, inside the upload's transaction. A parity
golden is checked in core, on the phone (real SQL) and through the API.

**Rationale:** The web map (portal Slice 1) must show the same turf as the phone; one rule set in
`packages/core` can't drift.

**Trade-off:** The phone stays the source of truth and doesn't read server turf. For a late Apple
Health import the phone's "new cells" can differ from the server's canonical first claimer (pinned
by a test).

---

## Why the mock account is `admin@cityturfer.com` (2026-10-17)

**Status:** Accepted, shipped on `scope/v0.2.0` (#25).

**Decision:** The single mock account's email is `admin@cityturfer.com` (was `admin@turftrack.com`);
the password stays `admin1234` and the user ID stays `admin`
(`apps/mobile/src/contexts/identity/infrastructure/mock-auth-gateway.ts`).

**Rationale:** Match the CityTurfer name in the sign-in screen and Maestro flows.

**Trade-off:** None for data: the database file is keyed by user ID (`turftrack-admin.db`), so
existing activities and the stored session carry over.

**Update (2026-10-22):** a second local profile, `demo@cityturfer.com` / `demo1234`, fills its own
database with Gdańsk demo data for screenshots.

**Update (2026-10-24):** both local profiles can back up after an e-mailed code proves their mailbox
(LP1); the demo profile uploads only its generated Gdańsk history, to demo@'s own account, and what
is recorded or imported on it stays on the phone (LP3,
`docs/decisions/local-profile-backup-2026-10-24.md`).

---

## Why a native background-session module, with expo-location kept as a safety net (2026-10-16)

**Status:** Accepted, verified on a real iPhone (65 min locked-screen walk, 4.07 km; session log
v0.1.0, day 2).

**Decision:** iOS recording runs through a local Expo module,
`apps/mobile/modules/background-session`: a `CLBackgroundActivitySession` plus a
`CLLocationUpdate.liveUpdates(.fitness)` stream (iOS 17+), restarted after relaunch and buffering
fixes until JS listens. The JS side is
`apps/mobile/src/contexts/recording/infrastructure/background-activity-session.ts`. expo-location's
background task stays on as a second stream ("safety net", `background-task.ts`); both feed one
serialized ingest queue and the Fix Filter drops duplicates.

**Rationale:** On device, iOS suspended the app about 50 s after each screen lock while locationd
still held its assertion: expo-location's `CLLocationManager` subscription does not keep a
workout-style app running. The live-updates stream inside a background activity session does.
Keeping expo-location means older binaries (OTA to a build without the module) and Android still
record.

**Trade-off:** Two location streams cost battery, and the module is native code: changing it needs a
new build, not an OTA. Switching off the redundant expo-location stream is an open follow-up once
more walks confirm the native tracker. The module is optional (`requireOptionalNativeModule`), a
no-op on Android.

---

## Why a background activity session alone (2026-10-15)

> **⚠️ Superseded by "Why a native background-session module…" (2026-10-16).** Kept for history: a
> `CLBackgroundActivitySession` on its own did not stop iOS suspending the app.

**Decision:** Hold a `CLBackgroundActivitySession` while recording, on top of expo-location's
background updates (76d64c9).

**Rationale:** Apple's documented way to keep a workout-style session alive in the background.

**Trade-off:** It was not enough: without the `liveUpdates` stream, fixes still stopped after the
screen locked.

---

## Why gap routes come from an OSM router and claim no turf (2026-10-15)

**Status:** Accepted. Whether estimated routes may claim turf later (shown dimmer until really
covered) is an open product decision.

**Decision:** A recording gap (GPS outage, now a new Segment when > 45 s) is estimated along streets
by the public FOSSGIS OSRM router (`routing.openstreetmap.de`, foot or bike profile;
`apps/mobile/src/contexts/activity-log/infrastructure/osm-route-estimator.ts`). Only the gap's two
endpoints are sent, never a whole track. Estimates are stored in `log_gap_routes`, drawn dashed,
counted in distance with a "≈", and **never claim turf**: a `GapRoute` is "display + distance only"
(`packages/core/src/contexts/activity-log/domain/gap-route.ts`); Territory claims cells from the
recorded Segments only.

**Rationale:** A straight line across a gap draws fake streets and fake turf. Street routing gives a
plausible distance; keeping it out of Territory keeps turf honest ("you were there").

**Trade-off:** Two coordinates per gap leave the device to a third-party server, outside the outbox
(best effort, after each dispatch run in `apps/mobile/src/wiring.ts`). Fine for the PoC; production
needs its own router. Implausible routes (too fast for the type, more than 4× the straight line) are
dropped.

**Update (2026-10-17, #33).** Privacy and fair use tightened: estimation is a user setting (**Me →
Info → Estimate GPS gaps along streets**; unset means on, off sends nothing,
`secure-store-gap-estimation-setting.ts`); endpoints are rounded to 4 decimals (~10 m); a break
after a manual Resume is never routed, nor a gap ending within 200 m of the activity's first or last
point (often home); requests are rate-limited per the FOSSGIS usage policy (one per second, 20 per
run, back off on 429 or offline; `application/router-budget.ts`) and identify the app in
`User-Agent`.

---

## Why OTA updates through EAS with a runtime fingerprint (2026-10-15)

**Status:** Accepted, OTA verified end to end on the iPhone (session log v0.1.0).

**Decision:** JS-only changes ship as EAS Updates on channel `production` (`app.json` `updates`,
`expo-channel-name: production`). `runtimeVersion.policy` is `fingerprint`: an update reaches only
binaries whose native fingerprint matches.

**Rationale:** A tester's phone gets fixes in minutes without a reinstall, and the fingerprint makes
it impossible to send JS that expects native code the binary doesn't have.

**Trade-off:** Anything that changes the fingerprint — native modules, config plugins, permissions,
icons, and `app.json` itself including its `version` — needs a new build. This is why the `app.json`
version pin had to wait for a reinstall (session log v0.2.0). Release PRs list the fingerprint they
ship (`docs/process/release-manager.md`).

---

## Why feature → scope → release → main (2026-10-15)

**Status:** Accepted. Exception: v0.1.0 went `scope/v0.1.0 → main` directly (#9), as the founder
asked.

**Decision:** `feat/<domain>` (and `fix/`, `chore/`, `docs/`, `test/`) → `scope/vX.Y.Z` →
`release/vX.Y.Z` → `main`; PR titles `city-turfer - <branch>`; merge commits; Conventional Commits;
the release workflow tags and writes `CHANGELOG.md` on `main`. Full policy:
`docs/process/release-manager.md`.

**Rationale:** Mirrors empatalk, so one founder runs both projects the same way. `scope/*`
integrates a version, `release/*` stabilises it on real devices, `main` only holds releasable code.
Merge commits keep the Conventional Commits the changelog is built from.

**Trade-off:** More PRs per change than trunk-based work, and fixes on `release/*` must be merged
back down into the next scope.

---

## Why local-first SQLite, one database per user (2026-10-15)

**Status:** Accepted. Since v0.8.0 an opt-in, one-way cloud backup to `apps/api` sits on top; the
phone stays the source of truth.

**Decision:** `expo-sqlite` is the source of truth. Each user gets their own database file, opened
and migrated in `getContainer()` (`apps/mobile/src/composition-root.ts`). Tables are prefixed by
owning context: `rec_` Recording, `log_` Activity Log, `ter_` Territory, `sys_` platform
(`apps/mobile/src/platform/migrations.ts`, append-only).

**Rationale:** Recording must survive a killed JS context, so every accepted fix is on disk within
one batch; a network round trip would be a reliability risk, and location data is personal data that
should stay on the device. One file per user makes sign-out and a future multi-user or sync step
simple.

**Trade-off:** Without the backup, losing the phone loses the history. The backup is a copy, not a
sync: the phone doesn't pull changes yet (`docs/decisions/data-flow-2026-10-23.md`, proposed).

---

## Why turf cells are H3 resolution 11 (2026-10-15)

**Status:** Accepted.

**Decision:** Turf Cells are H3 res 11 hexagons (~50 m across), with res 9 for zoomed-out
aggregation (`packages/core/src/h3/h3-cell-grid.ts`), behind Territory's `CellGrid` port so the
domain never sees h3-js. h3-js is loaded through a Hermes-safe loader
(`packages/core/src/h3/h3.ts`).

**Rationale:** ~50 m is street-sized: a walk down a street claims a corridor of cells, and a
neighbour street is a different cell. Hexagons have uniform neighbours, so corridors look even. The
port keeps a pure-TS grid as a drop-in if h3-js misbehaves (PoC risk R2).

**Trade-off:** Cell count grows fast with history (the PoC's Q4 budget is ~50k cells in a year),
which is why the `ter_cells` projection stores each cell's centroid with a `(lat, lon)` index for
viewport queries. Changing the resolution later means re-claiming every activity.

---

## Why a transactional outbox between contexts (2026-10-15)

**Status:** Accepted.

**Decision:** An aggregate change and its domain events are written in one SQLite transaction
(`appendToOutbox` into `sys_outbox`, `apps/mobile/src/platform/outbox.ts`). The `EventDispatcher`
delivers them after commit and on every app start to idempotent handlers: `SessionFinished` →
Activity Log, `ActivityRecorded` / `ActivityDeleted` / `ActivityTrackCorrected` → Territory, and
later Activity Log and Territory events → Health Sync (export to Apple Health) and Cloud Backup's
local queue (`apps/mobile/src/wiring.ts`).

**Update (2026-10-17, #30): retries and dead letters.** Delivery is strict FIFO. A failing event
blocks the queue while it is retried with exponential backoff (5 s base); it is dead-lettered
(`dead_lettered_at`) at once for a `DomainError` or an unreadable payload, otherwise after 5
attempts, and delivery continues past it. A dead letter logs a `task-error` diagnostic with the
event type and error code only, never the payload. Delivered events are pruned after 30 days, dead
letters after 90 (`pruneOutbox`, migration 5).

**Rationale:** The headless background task can be killed between any two steps. With the outbox, a
crash can't leave a finished session without its activity, or an activity without its turf: the
chain resumes on the next launch. The end-to-end test covers a crash between steps.

**Trade-off:** Eventual consistency inside one device (the UI can briefly show "Saving your
activity…"), and every handler must stay idempotent (claim id = activity id) and tolerate a missing
predecessor, because a dead-lettered event no longer stops the ones after it.

---

## Why DDD bounded contexts, enforced by dependency-cruiser (2026-10-15)

**Status:** Accepted, a hard requirement (`CLAUDE.md`).

**Decision:** Code is split into bounded contexts under `apps/mobile/src/contexts/*` (identity,
recording, activity-log, territory, achievements, health-sync, cloud-backup) with `domain/`,
`application/`, `infrastructure/` and `ui/` layers and a public `index.ts` (plus `contract.ts` for
published language). Since the monorepo (2026-10-18) the domain and application layers of Territory,
Activity Log, Achievements and Identity live in `packages/core`, so the API runs the same rules; the
app keeps re-export shims. `pnpm run test:arch` (each workspace's `.dependency-cruiser.cjs`, e.g.
`apps/mobile/.dependency-cruiser.cjs`, `packages/core/.dependency-cruiser.cjs`) fails the build when
domain code imports React, Expo, h3-js, MapLibre or infrastructure, when a context reaches into
another's layers, when a screen bypasses a context's `ui/`, or on any cycle.

**Rationale:** The PoC had to prove (Q5) that DDD works with Expo's background-task model: the
background task runs the same use cases as the UI because the domain doesn't depend on either.
Machine-enforced rules keep it true as agents write most of the code.

**Trade-off:** More files and indirection than a flat Expo app. Legitimising a new edge is a
deliberate change to `.dependency-cruiser.cjs`.

---

## Why vertical-slice milestones (2026-10-15)

**Status:** Accepted for the PoC (M1–M5 built; M6 field validation and the PoC report open).

**Decision:** Milestones are end-to-end slices: scaffold + auth → walk → turf → run and cycle →
history → field validation (`docs/poc-plan.md` §6).

**Rationale:** Each slice is testable on a device on its own, so the riskiest question (does
background recording work?) gets answered first, not last.

**Trade-off:** Some layers get revisited per slice instead of being designed once.

---

## Why mock sign-in for the PoC (2026-10-15)

**Status:** Accepted. Email updated 2026-10-17 (see the first entry).

**Decision:** `MockAuthGateway` behind the `AuthGateway` port, one account, session in
`expo-secure-store`. No Firebase. Data stays on the device, one database per user. Superseded in
part on 2026-10-22 (decision B6, `docs/plans/backend-plan-2026-10-22.md`): the mock `admin` and
`demo` profiles stay in every build, next to real accounts by e-mailed code; the production start
guard was removed.

**Rationale:** Auth is a generic subdomain; the PoC is about recording and turf. The port means a
real provider later is one adapter.

**Trade-off:** No real accounts until a provider is chosen. Since v0.9.0 accounts sign in by
e-mailed code through the API (Better Auth; `ApiAuthGateway`), with an optional account password
since v0.10.0. Sign in with Apple or a no-account mode is still an open App Store question.

---

## Why GPX import is a dev tool and GPX export a stretch goal (2026-10-15)

**Status:** Accepted, amended in practice: seeding happens in the app through the demo history
seeder (`apps/mobile/src/dev/demo-history.ts` via `ImportActivity`), and GPX files are read only by
tests (`apps/mobile/src/test-support/fixtures.ts`). GPX export is not built. Since #27 (2026-10-17)
the seeder sits under **Me → Info → Developer tools**, shown in dev builds or after five
long-presses on the version text, next to **Remove demo data**.

**Decision:** Importing tracks exists to seed test history. Exporting GPX to other apps is M7
stretch.

**Rationale:** The turf map needs months of history to judge (Q3, Q4); nobody has that on day one.

**Trade-off:** No way to get data out of the app yet.

---

## Why MapLibre + OpenFreeMap instead of react-native-maps (2026-10-15)

**Status:** Accepted. Full record:
[`decisions/maplibre-over-react-native-maps-2026-10-15.md`](../decisions/maplibre-over-react-native-maps-2026-10-15.md).

**Decision:** Every map uses `@maplibre/maplibre-react-native` with keyless OpenFreeMap vector
tiles; the Turf Map uses the dark style.

**Rationale:** The Turf Map needs GPU, data-driven styling: heatmap glow, blurred overlapping
tracks, thousands of cells. react-native-maps renders each polygon as a native object and has no
heatmap or blur. No Google Maps key.

**Trade-off:** Xcode's SPM download of MapLibre hangs on the dev Mac, hence
`apps/mobile/tools/fetch-maplibre-ios.sh` and `apps/mobile/plugins/with-local-maplibre.js`.

---

## Why single user, on device, with corridor turf (2026-10-15)

**Status:** Accepted for the PoC.

**Decision:** One user per device, data on the device. Turf is a corridor of cells along the
recorded track plus a glow; closed loops don't claim the area inside (cells come from points along
each Segment, `packages/core/src/contexts/territory/domain/claim.ts`).

**Rationale:** "Every street you cover" is the product promise; filling a loop would claim streets
you never walked.

**Trade-off:** No competition or shared turf yet; that needs a backend.

---

## Why the Turf Map is always dark (2026-10-15)

**Status:** Accepted.

**Decision:** The Turf Map always uses the dark style (`MAP_STYLE_DARK`,
`apps/mobile/src/contexts/territory/ui/turf-map-view.tsx`). Other screens followed the system theme
until 2026-10-20 (see "The whole app is dark, like the website").

**Rationale:** The glow — the reason to open the map — only reads on a dark basemap.

---

## The whole app is dark, like the website (2026-10-20)

**Status:** Accepted. Extends "Why the Turf Map is always dark". The website went light in v0.10.0
(`SITE_SCHEME`, `docs/decisions/brand-light-theme-2026-10-22.md`); the app and its maps stay dark.

**Decision:** The app always uses the brand's dark theme (`userInterfaceStyle: "dark"` in
`apps/mobile/app.json`, so `useColorScheme()` reports `dark` and `usePalette()` returns `DARK`). The
Record map uses `MAP_STYLE_DARK` and draws turf exactly as the Turf Map does (`TURF_STYLE`).

**Rationale:** Founder request: the app should look like the homepage, which is dark only
(`cssVariables('dark')`), and the Record map should show turf in the same colours as the Turf Map.
The `LIGHT` theme stays in `@cityturfer/brand` for Storybook and a possible light mode later.

**Consequence:** `app.json` is native config, so this changes the runtime fingerprint: it ships in a
new build, not over the air. Two traps: `expo-splash-screen` resets iOS to `Automatic` whenever its
config has a `dark` block (so the splash has none; it was identical anyway), and Android only
honours `userInterfaceStyle` with `expo-system-ui` installed.

**Trade-off:** One screen ignores the user's theme.

---

## Why turf is permanent (2026-10-15)

**Status:** Accepted.

**Decision:** Claimed cells never fade or get lost. Strength depends only on the number of visits:
`strength = 1 − exp(−visits / 3)` (`packages/core/src/contexts/territory/domain/strength.ts`,
identical in `apps/mobile/tools/lib/turf.mjs`, which `turf-preview.mjs` uses; pinned by
`apps/mobile/tools/fixtures/turf-vectors.json`). Deleting an activity is the only way turf shrinks.

**Rationale:** Turf is a record of where you've been, not a chore to maintain. "Recent activity"
belongs in summaries (new turf this week), not in Strength.

**Trade-off:** Old turf never motivates a revisit by decaying. Time decay needs a product decision
before it comes back.

---

## Why iOS and Android are both first-class (2026-10-15)

**Status:** Accepted as the target; **only iOS is verified on a device so far**. Since v0.4.0 an
Android APK is built on EAS and sideloaded from the website; it ran on an emulator
(`docs/operations/android-release.md`), never on a phone.

**Decision:** Both platforms are first-class. Field tests (Q1, Q4) need one physical device per
platform; the Android should be mid-range (e.g. a Samsung Galaxy A-series), not a flagship.

**Rationale:** Background location and OEM battery killers behave very differently per platform; a
PoC verified on one platform proves nothing about the other.

**Trade-off:** Twice the device testing; the iOS-only native module needs an Android counterpart or
the expo-location foreground service must prove enough on its own.
