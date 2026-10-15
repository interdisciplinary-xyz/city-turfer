# TurfTrack — Proof of Concept Plan (Domain-Driven Design)

Status: draft v5 · 2026-10-15 · v5: mock sign-in instead of Firebase · v4: vertical-slice milestones · v2 added **Turf** (the main feature) and switched maps to MapLibre · v3: turf is permanent, platform and theme decisions (§9).

## 0. The product in one paragraph

You record your walks, runs and rides on a real map. Every route you cover becomes your **turf**: the streets you pass are claimed as a corridor of map cells. Turf is **permanent**: once claimed, a cell is yours for good, and it **glows** brighter each time you come back. The Turf Map overlays all your tracks at once, so routes you repeat light up and stand out from places you've been only once. The PoC has a **mock sign-in** (one fixed account), and all data stays on the device; the model is built so sync and other users' turf can be added later.

## 1. What the PoC must prove

| #      | Question                                                                                                         | Pass criterion                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1     | Can we record a route reliably with the screen locked, the app backgrounded, and after the OS kills the process? | 30-min recording on a physical iPhone **and** Android phone, screen locked the whole time: no gap > 30 s in the track. After a process kill mid-recording, the user can resume with zero points lost.                                                                                                                                                                                                                 |
| Q2     | Are the stats correct?                                                                                           | Simulator replay of `tools/fixtures/*`: distance within ±3% of `truth.distanceM`, moving time within ±5 s of the oracle. On a device: N laps of a 400 m athletics track within ±5%.                                                                                                                                                                                                                                   |
| **Q3** | **Does the turf map work, and does it feel rewarding?**                                                          | With 120 days of seeded history (`tools/gen-history.mjs`) plus at least 2 weeks of real use, the Turf Map shows tracks overlapping and brightening. Strength values match the reference formula exactly (shared test vectors). Claimed cells never disappear (deleting an activity is the only way turf shrinks). One tester can point out their most-covered street and the edge of their turf, without explanation. |
| **Q4** | **Does the turf map stay fast as history grows?**                                                                | With a seeded year (~200 activities, ~50k cells) on a mid-range Android phone: the Turf Map opens in < 1.5 s, panning and zooming have no visible stutter, and claiming turf from a 2-hour ride takes < 300 ms.                                                                                                                                                                                                       |
| Q5     | Does DDD work with Expo's background-task model without fighting it?                                             | The domain layer has zero imports from react, react-native or expo-*, enforced by an automated architecture test. The background task runs the same use cases as the UI.                                                                                                                                                                                                                                              |

Also **measured, not gated**: battery drain per hour of recording, and DB size per year of history.

### In scope

**Sign in (mock account)** → choose an activity type → start / pause / resume / stop → live map + stats → automatic pause → save or discard → history list + activity detail (map, summary, splits, **turf gained**) → **Turf Map** (all tracks overlapping, glowing turf cells, type filter, turf summary) → recovery after the process is killed → dev-only GPX import, to seed history for testing.

### Out of scope (after the PoC)

Real accounts (sign-up, password reset, social login), other users' turf, cloud backend and data sync · contested turf between users · closed loops claiming the area inside them · settings screen (hard-coded metric units, auto-pause on, default turf parameters) · barometric elevation and calories · sharing and privacy zones · GPX export (stretch goal).

## 2. Ubiquitous language

| Term                           | Meaning                                                                                                                | Not                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Activity Type**              | `walk`, `run` or `cycle`.                                                                                              | sport, mode                |
| **Recording Session**          | A recording in progress, from Start until Finish or Discard.                                                           | workout, tracking          |
| **Fix**                        | One raw location reading from the device, before filtering.                                                            | location, position         |
| **Track Point**                | A Fix that passed the Fix Filter.                                                                                      | coordinate, GPS point      |
| **Segment**                    | An uninterrupted run of Track Points. Each Resume starts a new one.                                                    | lap                        |
| **Track**                      | The ordered Segments of a session or activity.                                                                         | route (UI copy only), path |
| **Tracking Profile**           | Per-type tuning: GPS interval, filter thresholds, auto-pause.                                                          | config                     |
| **Auto-pause**                 | The system pausing a session because the user stopped moving.                                                          | —                          |
| **Elapsed / Moving Time**      | Wall-clock time vs. time actually moving.                                                                              | duration                   |
| **Activity**                   | A finished, saved Recording Session.                                                                                   | run, session               |
| **Activity Summary**           | Distance, times, pace or speed, elevation and splits.                                                                  | stats                      |
| **Turf**                       | Everything the user has claimed and not yet lost.                                                                      | territory (in code), area  |
| **Turf Cell**                  | One hexagonal map cell: the unit of turf (H3 resolution 11, ~50 m across).                                             | tile, hex, square          |
| **Corridor**                   | The cells a Track passes through.                                                                                      | buffer                     |
| **Claim**                      | The set of Turf Cells one Activity covered. It is created once per Activity, and a cell counts at most once per Claim. | conquest, capture          |
| **New Cell / Reinforced Cell** | A cell in a Claim that wasn't turf before, or one that already was.                                                    | —                          |
| **Strength**                   | A value from 0 to 1 for how firmly a cell is held. It grows with the number of visits and never decreases.             | intensity, score           |
| **Glow**                       | How Strength looks on the map: colour, brightness and halo. A presentation concept, not domain.                        | radiance                   |

## 3. Strategic design

### Subdomains

| Subdomain                                                                       | Type                       | Why                                                                                        |
| ------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| **Territory**                                                                   | **Core**                   | The differentiator: no other tracker turns your history into glowing turf.                 |
| **Recording**                                                                   | **Core**                   | Without reliable tracks there is no turf. Quality-critical.                                |
| Activity Log                                                                    | Supporting                 | Stores and presents finished activities.                                                   |
| Track Analytics                                                                 | Supporting (shared kernel) | Pure maths on tracks and measures.                                                         |
| **Identity** (sign-in, current user)                                            | Generic                    | Mocked in the PoC. A thin context with a port, so a real provider can be plugged in later. |
| Device location, permissions, persistence, map rendering, spatial indexing (H3) | Generic                    | Wrapped behind ports and adapters.                                                         |

### Context map

```
                ┌──────────────────────── Shared Kernel ───────────────────────────┐
                │ GeoPoint · BoundingBox · Distance · Duration · Pace · Speed ·     │
                │ ActivityType · Track/Segment · TrackAnalyzer · Instant · Id       │
                └──────▲─────────────────────────▲──────────────────────────▲───────┘
                       │                         │                          │
expo-location ─ACL─▶ ┌─┴───────────┐ SessionFinished ┌──┴───────────┐ ActivityRecorded ┌──┴──────────┐
expo-task-mgr ─────▶ │  RECORDING  │ ───(outbox)───▶ │ ACTIVITY LOG │ ───(outbox)────▶ │  TERRITORY  │
                     │   (core)    │ ◀── query ───── │ (supporting) │ ActivityDeleted  │   (core)    │
                     └─────────────┘ FinishedTrack   │              │ ◀── query ────── │             │
                                     (OHS)           └──────────────┘ ActivityTrack    └──────┬──────┘
                                                                      (OHS)                   │ CellGrid port
                                                                                       h3-js ─ACL─┘
```

- **Identity → everyone** (upstream, conformist): other contexts only see a `UserId` value and the `CurrentUser` query. The auth implementation (mock now, a real provider later) never leaves `identity/infrastructure`. Signing in selects the user's database; signing out closes it.
- **Recording → Activity Log**: `SessionFinished` event. Activity Log pulls the track through Recording's `FinishedTrackQuery`.
- **Activity Log → Territory**: `ActivityRecorded` and `ActivityDeleted` events (published language: activityId, type, startedAt, endedAt). Territory pulls the track through Activity Log's `ActivityTrackQuery`. Territory never sees Recording.
- **ACLs**: `ExpoLocationTracker` translates `LocationObject` → `Fix`. `H3CellGrid` hides h3-js behind Territory's `CellGrid` port, which keeps the domain free of library types and lets us swap the grid (see risk R2).

## 4. Tactical design

### 4.0 Identity context (generic)

- **Value objects**: `UserId`, `Email`, `UserProfile` (display name, email).
- **Port `AuthGateway`**: `signIn(email, password)`, `signOut()`, `currentUser()`, `onAuthStateChanged(listener)`. In the PoC it is implemented by **`MockAuthGateway`**, which accepts exactly one account:
  - email `admin@turftrack.com`, password `admin1234` → `UserId("admin")`, display name "Admin".
  - Anything else → `AuthError('invalid-credentials')`. There is no sign-up, password reset or social login in the PoC.
- **Use cases**: `SignIn`, `SignOut` (refused while a Recording Session is active), `GetCurrentUser`.
- **Session**: the signed-in uid is stored in `expo-secure-store`, so the app opens signed in after a restart, and the headless background task can open the right database.
- **Data isolation**: one SQLite file per user (`turftrack-<uid>.db`). With a single mock user this looks redundant, but it's what makes swapping in real accounts later a one-adapter change.
- **Replaceability**: the mock credentials live only in `identity/infrastructure/MockAuthGateway.ts`. Nothing outside it knows they exist. A real provider (Firebase, Supabase, Auth0…) later means a new adapter plus a line in the composition root.
- **Not for production**: the mock gateway is selected only when `EXPO_PUBLIC_AUTH_MODE=mock` (the default for the PoC). A store or production build must fail at startup if it's still in mock mode.

### 4.1 Recording context

**Aggregate `RecordingSession`.** Its boundary is the state, current segment, tail and running totals, **not** the full point list. Accepted points go to an append-only `TrackPointLog` in the same transaction. The reason: a 2-hour ride is about 7,000 points, and reloading them all for every background batch would be too slow.

Commands: `start`, `pause`, `resume` (segment++), `ingest(fixes) → TrackPoint[]` (Fix Filter + Auto-pause), `finish`, `discard`, `snapshot`.
Invariants: one active session at a time · points accepted only while Recording or AutoPaused · strictly increasing timestamps · no distance across segments · Finished and Discarded are terminal · finishing needs ≥ 2 points.
Events: `SessionStarted`, `SessionPaused`, `SessionResumed`, `AutoPaused`, `AutoResumed`, `SessionFinished`, `SessionDiscarded`.
Use cases: `StartRecording`, `PauseRecording`, `ResumeRecording`, `IngestFixes` (called from the background task), `FinishRecording`, `DiscardRecording`, `RecoverSession`, `GetLiveSnapshot`, `GetLiveTrack`. Open-host service: `FinishedTrackQuery`.
Ports: `RecordingSessionRepository`, `TrackPointLog`, `LocationTracker`, `PermissionGateway`, `Clock`, `IdGenerator`.

### 4.2 Activity Log context

**Aggregate `Activity`**: id (= session id), type, name, startedAt, endedAt, `ActivitySummary`, and a reference to its Track. Command: `rename`.
Use cases: `RecordActivityFromSession` (handles `SessionFinished`, emits `ActivityRecorded`), `ListActivities`, `GetActivityDetail`, `RenameActivity`, `DeleteActivity` (emits `ActivityDeleted`), and **`ImportActivityFromGpx`** (dev builds only in the PoC, for seeding history; emits `ActivityRecorded`, so imported activities claim turf just like recorded ones). Open-host service: `ActivityTrackQuery`.
When Recording receives `ActivityRecorded`, it purges the session's points.

### 4.3 Territory context (new, core)

**Aggregate `Claim`**: id (= activity id, which makes the handler idempotent), activityType, claimedAt (= the activity's startedAt, _not_ the import time), and `cells: ReadonlySet<CellId>`.

- Created by `Claim.fromTrack(activity, track, grid)`, which densifies each segment so no cell is skipped (sampling every ≤ ½ cell width) and maps points to cells. It never joins cells across segment gaps.
- Invariants: at least one cell · each cell at most once (that's what "counts once per activity" means) · immutable once created · rejected if the activity is in the future.
- Turf is permanent: the only way a cell leaves the Territory is when every Claim containing it is released (its activities deleted).
- Events: `TurfClaimed { activityId, newCells, reinforcedCells, newAreaM2 }`, `TurfReleased { activityId }` (when the activity is deleted).

**Projection `Territory`** (a read model, folded from Claims). For each cell: `cellId`, `parentCell` (H3 resolution 7, for viewport queries), `visits`, `visitsByType`, `firstClaimedAt`, `lastVisitedAt`.

- Applying a Claim is an O(1) increment per cell, and the order doesn't matter, so importing old activities needs no special handling. Releasing a Claim decrements, and deletes the cell when `visits` reaches 0.
- The projection can always be rebuilt from Claims (`RebuildTerritory`). That makes parameter changes and migrations safe.

**Value objects**: `CellId`, `Strength` (0–1, with tier `faint | glowing | strong | blazing`), `TurfParameters` (saturationK = 3), and `TurfSummary` (total area in m², counts by tier, new area in the last 7 and 30 days, most-visited cell).

**Domain policy `TurfStrengthPolicy`** is the reference formula, identical to `tools/turf-preview.mjs`:

```
strength = 1 − exp(−visits / k)        k = 3: 1 visit → 0.28 · 3 → 0.63 · 7 → 0.90 · 10 → 0.96
```

Shared test vectors (in `tools/fixtures/turf-vectors.json`, generated in M3) pin the tool and the app to the same numbers.

**Port `CellGrid`**: `cellOf(GeoPoint)`, `boundary(CellId)`, `parent(CellId, res)`, `cellsCovering(BoundingBox, res)`, `areaM2(CellId)`. It's implemented by `H3CellGrid` (infrastructure), with `SquareCellGrid` as a fallback.

**Use cases**: `ClaimTurfFromActivity` (handles `ActivityRecorded`), `ReleaseTurfOfActivity` (handles `ActivityDeleted`), `GetTurfInViewport(bbox, zoom, types?)`, `GetTurfSummary()`, `GetClaimForActivity(activityId)` (for "turf gained" on the activity detail), `RebuildTerritory`.

`GetTurfInViewport` returns cells at a level of detail that depends on zoom: individual resolution-11 cells at zoom ≥ 14, aggregated to resolution 9 (max strength) below that. This keeps the number of rendered features under ~5k.

### 4.4 Shared Kernel

`GeoPoint`, `BoundingBox`, `Distance`, `Duration`, `Pace`, `Speed`, `ActivityType`, `Segment`, `Track`, `TrackAnalyzer` (distance per segment, moving time, splits, elevation, Douglas–Peucker simplification), `DomainEvent`, `DomainError`, `Instant`, `Id`. Its numbers match `tools/lib/geo.mjs`.

### 4.5 Events and the outbox

Events are written to `sys_outbox` in the same SQLite transaction as the change that produced them. The `EventDispatcher` delivers them after commit and on app start. Handlers are idempotent (aggregate id = upstream id, `INSERT OR IGNORE`). The chain `SessionFinished → ActivityRecorded → TurfClaimed` therefore survives the process dying at any step.

## 5. Architecture

### Layers and dependency rule

```
ui (screens, hooks) ─▶ application ─▶ domain ─▶ shared-kernel
infrastructure ─▶ application, domain (implements ports)
composition root ─▶ everything (wiring only)
```

`domain/` and `shared-kernel/` import nothing from react, react-native, expo-*, zustand, **h3-js**, **maplibre** or any infrastructure. Contexts reach each other only through `index.ts` and published events. Enforced by dependency-cruiser in `npm test` (see the `ddd-architecture` skill).

### Folder layout

```
app/                                   expo-router screens (thin)
  _layout.tsx                          1st import: recording/infrastructure/backgroundTask
  (auth)/sign-in.tsx
  (tabs)/index.tsx                     Record
  (tabs)/turf.tsx                      Turf Map  ← main screen
  (tabs)/history.tsx                   History
  activity/[id].tsx                    Activity detail (+ turf gained)
src/
  shared-kernel/
  contexts/
    identity/      domain/ application/ infrastructure/ ui/ index.ts
    recording/     domain/ application/ infrastructure/ ui/ index.ts
    activity-log/  domain/ application/ infrastructure/ ui/ index.ts
    territory/     domain/ application/ infrastructure/ ui/ index.ts
  platform/                            db, migrations, outbox, EventDispatcher, logger, map style
  composition-root.ts                  lazy, React-free; used by UI and the headless task
```

### Maps: MapLibre (stack change from v1)

The Turf Map needs GPU, data-driven styling for thousands of features: a heatmap layer for the glow when zoomed out, fills coloured by Strength, line blur and transparency so overlapping tracks brighten. `react-native-maps` renders each polygon as a native object and can't do heatmaps or blur. **Decision: use `@maplibre/maplibre-react-native` for every map in the app, with keyless OpenStreetMap vector tiles from OpenFreeMap and a dark style for the Turf Map.** This also removes the need for a Google Maps API key. It gets verified in the M2 spike, and the fallback is in the risks table.

**Turf Map layers** (bottom to top):

1. Dark basemap (streets visible but muted).
2. `turf-heat`: a heatmap layer of cell centroids weighted by Strength, shown at zoom < 13. This is the "radiating" overview of a whole city.
3. `turf-glow`: a cell fill layer with blur and transparency (a halo), and `turf-cells`: a crisp cell fill coloured by Strength tier (violet → magenta → amber → white-hot), shown at zoom ≥ 13.
4. `tracks`: every Track, simplified, as thin lines with opacity 0.15–0.2, line blur and the type's colour. Overlaps get brighter naturally.
5. A type filter (walk, run, cycle), and a summary card: total turf in km², strong cells, and new turf this week and month.

The reference look is `tools/turf-preview.mjs` (run it to see it).

### Persistence (one SQLite DB per user, tables owned per context)

| Owner        | Tables                                                                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recording    | `rec_sessions`, `rec_track_points`                                                                                                                                                                                                                    |
| Activity Log | `log_activities`, `log_track_points`                                                                                                                                                                                                                  |
| Territory    | `ter_claims` (activity_id PK, type, claimed_at, cell_count, new_cell_count), `ter_claim_cells` (activity_id, cell) — the source of truth; `ter_cells` (cell PK, parent_r7 indexed, visits, walk/run/cycle counts, first_at, last_at) — the projection |
| Platform     | `sys_schema_version`, `sys_outbox`                                                                                                                                                                                                                    |

## 6. Milestones

Each milestone is a **vertical slice**: it ends with something a person can install and try on both an iPhone and an Android phone. Durations are rough estimates for one developer working with the agents.

| M      | Slice                                          | ≈ days                    | Demo at the end                                                                                   |
| ------ | ---------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| **M1** | Scaffold + mock sign-in                        | 3                         | Install the app, sign in as admin, sign out and back in, on both platforms                        |
| **M2** | Register a walk                                | 8                         | Record a walk with the screen locked, see it on the map, find it in the list                      |
| **M3** | Turf overview                                  | 7                         | Open the Turf Map and see your walks glowing, with brighter streets where you walk often          |
| **M4** | Register running and cycling                   | 3                         | Record a run and a ride, each with the right stats and colour on the Turf Map                     |
| **M5** | History and activity details                   | 3                         | Browse all activities, see splits and turf gained, rename one, delete one (its turf goes with it) |
| **M6** | Field validation + PoC report                  | 3 (+ 2 weeks of real use) | Go / no-go report for Q1–Q5                                                                       |
| M7     | _Stretch_: GPX export, live "claiming" overlay | 2                         | Share a run to Strava; watch new turf light up while recording                                    |

Total ≈ 27 days, plus 2 weeks of real use that run alongside M4–M6.

### M1 — Scaffold + sign-in

**Goal:** an installable app on both platforms with the full architecture in place and working accounts. Nothing to record yet.

Build:

1. Expo project, dev builds on iOS and Android, TypeScript strict, Jest, the `scaffold-app` skill.
2. DDD skeleton: `shared-kernel/`, `contexts/{identity,recording,activity-log,territory}/` (empty layers), `platform/`, composition root. dependency-cruiser rules, proven by a deliberate violation.
3. Platform: SQLite opened **per user** (`turftrack-<uid>.db`), migrations, outbox, EventDispatcher.
4. **Identity context** (§4.0): the `AuthGateway` port with `MockAuthGateway` (`admin@turftrack.com` / `admin1234`). Session persisted, so the app opens signed in.
5. Screens: sign in (email + password, a clear error for wrong credentials) → an empty "home" with tabs (Record, Turf, History) as placeholders → sign out.

Agents: location-engineer (skeleton, platform, identity), mobile-ui-engineer (auth screens), rn-architect (reviews the skeleton).
**Needs from you:** nothing for the app itself. Installing on a physical iPhone needs an Apple ID for code signing (a free one works for testing, but its builds expire after 7 days).
**Exit:** the admin account signs in, wrong credentials are rejected, and sign-out works on both platforms; the app stays signed in after a restart and in airplane mode; unit tests cover `MockAuthGateway` and the sign-in use cases; Maestro `sign-in.yaml` passes. tsc, jest and the architecture test pass.

### M2 — Register a walk

**Goal:** the core loop for one activity type, end to end and reliable.

Build:

1. **Spike** (first 1–2 days): MapLibre + OpenFreeMap in the dev build on both platforms. Record the go/fallback decision in `docs/spikes.md`.
2. Shared kernel + Recording domain, test-first: `RecordingSession`, `FixFilter`, `AutoPausePolicy`, with only the **walk** `TrackingProfile`.
3. Recording application + infrastructure: use cases, SQLite repository + outbox, `ExpoLocationTracker` (ACL), background task, `RecoverSession`.
4. Permission onboarding (foreground → background, the Android "Allow all the time" explanation).
5. Record screen: start / pause / resume / long-press stop, live map following you, live distance / time / pace, state banners (waiting for GPS, paused, auto-paused), resume prompt after a kill.
6. Minimal Activity Log: `RecordActivityFromSession` via the outbox, a simple list (date, distance, duration) and a detail screen with the route map and summary.

Agents: location-engineer (2, 3, 6 backend), mobile-ui-engineer (4, 5, 6 screens), mobile-test-engineer (fixtures, simulator replay, `record-walk.yaml`).
**Exit:** every Recording invariant has a test; the walk fixture matches the oracle within ±3%; a simulator replay with the app backgrounded for 60 s shows no gap; a **real 20-min walk with the screen locked** on both platforms produces a gap-free track; killing the app mid-walk loses no points; Maestro `record-walk.yaml` passes.

### M3 — Turf overview

**Goal:** the main feature: your walks become glowing, permanent turf on a dark map.

Build:

1. **Spike** (first day): h3-js on Hermes, and rendering 50k cells (heatmap + fill + blur) on a mid-range Android.
2. Territory domain: `Claim`, `TurfStrengthPolicy`, `CellGrid` port; `turf-vectors.json` generated from the reference formula.
3. Territory application + infrastructure: `H3CellGrid`, the projection, `ClaimTurfFromActivity` (via `ActivityRecorded`), viewport query with level of detail, summary query, rebuild.
4. Dev-only `ImportActivityFromGpx` (dev menu: "Import fixture history"), so the map can be tested with months of history.
5. **Turf Map** tab: always dark, heatmap glow when zoomed out, strength-coloured cells when zoomed in, all tracks overlapping, summary card (total km², strong cells, new this week).
6. "Turf gained" card after Finish ("+0.12 km² new turf · 340 cells reinforced").

Agents: location-engineer (1–4), mobile-ui-engineer (5, 6, styling from `turf-preview.mjs`), mobile-test-engineer (benchmarks, `turf-map.yaml`).
**Exit:** strength matches the vectors exactly; in-order import, reverse-order import and rebuild produce identical projections; claiming a 2-hour track takes < 300 ms; with a seeded year on a mid-range Android the Turf Map opens in < 1.5 s with no visible stutter; screenshots compared with the preview tool; Maestro `turf-map.yaml` passes.

### M4 — Register running and cycling

**Goal:** all three activity types, each tuned properly.

Build:

1. **Run** and **cycle** `TrackingProfile`s (GPS interval, filter thresholds, auto-pause), with tests on the run and cycle fixtures.
2. Activity-type picker on the Record screen; pace (min/km) for walk and run, speed (km/h) for cycle.
3. Type colours (walk green, run orange, cycle blue) on the live map, list and Turf Map tracks; a walk / run / cycle filter on the Turf Map.
4. Per-type turf counts in the projection (`visitsByType`), used by the filter.

Agents: location-engineer (1, 4), mobile-ui-engineer (2, 3), mobile-test-engineer.
**Exit:** run and cycle fixtures match the oracle within ±3% (including outliers and a pause); a real run and a real ride recorded on a device; the Turf Map filter shows only the selected types; Maestro `record-run.yaml` and `record-ride.yaml` pass.

### M5 — History and activity details

**Goal:** a complete, trustworthy activity log.

Build:

1. History list: activity thumbnails (route preview), type icon, date, distance, duration, infinite scroll.
2. Activity detail: full map, summary, km splits, elevation (marked as approximate), turf gained with that activity's cells highlighted.
3. Rename; delete with confirmation, emitting `ActivityDeleted` → `ReleaseTurfOfActivity` (the only way turf shrinks).
4. Recording purges a session's points once `ActivityRecorded` is processed.

Agents: location-engineer (3, 4), mobile-ui-engineer (1, 2), mobile-test-engineer.
**Exit:** a kill between Finish and save still produces the Activity and its turf; deleting an activity removes exactly its turf (rebuild-equality test); the list scrolls smoothly with a seeded year; Maestro `history-detail.yaml` and `delete-activity.yaml` pass.

### M6 — Field validation + PoC report

**Goal:** answer Q1–Q5 with evidence.

Build / do:

1. A mobile-reviewer pass over the whole codebase; fix the blocking findings.
2. 30-min locked-screen recordings on both platforms; N laps of a 400 m track; a kill test; battery drain per hour.
3. 2 weeks of real use (running alongside M4–M6) and a tester session for Q3.
4. `docs/poc-report.md`: a go / no-go per question, with evidence, and recommendations for the next phase (multi-user, sync).

Agents: mobile-test-engineer, mobile-reviewer.
**Exit:** the report is written, with evidence for every question.

### M7 — Stretch

GPX export (share sheet, Strava-compatible). Live "claiming" overlay while recording, using Territory's pure `previewClaim`.

**Critical path:** M1 → M2 → M3 → M4 → M5 → M6. **Overlaps:** the M3 spike and Territory domain (pure and fixture-driven) can start once the M2 domain is done; M4's profiles can be developed alongside M3's UI work; real-use data collection starts as soon as M2 ships.

## 7. Testing strategy

| Layer                           | How                                                                                                                                                                                                | Tooling                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Shared kernel, Recording domain | Pure unit tests, with expected values from the oracle or fixture `truth`.                                                                                                                          | Jest, `gen-route.mjs`, `route-stats.mjs`    |
| Territory domain                | Claims from fixtures (no skipped cells, one count per cell, segment gaps not bridged), strength from `turf-vectors.json`, permanence (only a release removes a cell), projection rebuild equality. | Jest, `gen-history.mjs`, `turf-preview.mjs` |
| Application                     | Use cases with in-memory repositories, a `FakeCellGrid` (square grid), `FakeClock`, `FakeLocationTracker`.                                                                                         | Jest                                        |
| Infrastructure                  | Real SQL (better-sqlite3 adapter); the H3 adapter against known cell ids; the outbox chain Session → Activity → Claim, including a simulated crash between steps.                                  | Jest                                        |
| Architecture                    | Dependency rules.                                                                                                                                                                                  | dependency-cruiser                          |
| Performance                     | Benchmark tests for claiming a 2-hour ride and querying the viewport over a seeded year. Map frame-time checks on a device.                                                                        | Jest bench, a dev overlay with an FPS meter |
| End to end                      | Simulator replay + Maestro (`record-run`, `history-detail`, `turf-map`).                                                                                                                           | `sim-location.sh`, Maestro                  |
| Field                           | Physical devices, as in M6.                                                                                                                                                                        | Manual, with the results in the report      |

## 8. Risks

| #   | Risk                                                                                     | Impact                          | Mitigation                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | MapLibre RN doesn't behave in an Expo dev build, or the heatmap/blur look poor on device | High                            | M2 spike. Fallback: react-native-maps with cells merged into one multipolygon per Strength tier (h3 `cellsToMultiPolygon`). That gives a weaker glow but stays performant.                    |
| R2  | h3-js performs badly or breaks on Hermes                                                 | Medium                          | M3 spike. The `CellGrid` port allows a pure-TS `SquareCellGrid` (as in `turf-preview.mjs`) as a drop-in.                                                                                      |
| R3  | The Turf Map slows down after months of use                                              | High                            | Level of detail by zoom (res 9 below zoom 14), viewport queries on `parent_r7`, simplified tracks cached per activity, the < 5k feature budget, benchmark tests in M3 and M5.                 |
| R4  | Turf feels unrewarding (everything soon turns white-hot, or one visit barely shows)      | Medium                          | Tune `saturationK` with `turf-preview.mjs` on seeded and real data. Get feedback on Q3 from the tester session. Changing it needs no migration, because strength is computed on read.         |
| R5  | GPS noise claims cells next to the street you were actually on                           | Low                             | Cells are ~50 m wide, wider than typical GPS error after filtering. Claims use filtered points only.                                                                                          |
| R6  | Background tracking killed by the OS (Android OEMs)                                      | High                            | Foreground service, battery-optimisation onboarding, `RecoverSession`.                                                                                                                        |
| R7  | DDD ceremony slows a PoC                                                                 | Medium                          | Tactical patterns only where they protect an invariant. Plain functions in the composition root, no DI or CQRS framework. The Territory projection is a plain read model, not event sourcing. |
| R8  | The Turf Map reveals where the user lives, and permanent turf keeps that forever         | Low in the PoC (on-device only) | No sharing in the PoC. Before anything is shared or multi-user: privacy zones that hide cells around saved places.                                                                            |

## 9. Decisions log

| Date       | Decision                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-15 | Platforms: **iOS and Android**, both first-class. Field tests (Q1, Q4) need one physical device per platform; for Q4 the Android should be mid-range (e.g. Samsung Galaxy A-series), not a flagship.                                             |
| 2026-10-15 | **Turf is permanent.** Claimed cells never fade or get lost. Strength depends only on the number of visits.                                                                                                                                      |
| 2026-10-15 | **The Turf Map is always dark.** Other screens follow the system theme.                                                                                                                                                                          |
| 2026-10-15 | Single user, on-device, in the PoC. Turf is a corridor + glow (closed loops don't claim area).                                                                                                                                                   |
| 2026-10-15 | Maps: MapLibre + OpenFreeMap (keyless), replacing react-native-maps.                                                                                                                                                                             |
| 2026-10-15 | GPX **import** is in the PoC as a dev tool, for seeding test history. GPX **export** (sharing activities with other apps) stays a stretch goal (M7).                                                                                             |
| 2026-10-15 | **Auth: mock sign-in** for the PoC, with a single account `admin@turftrack.com` / `admin1234`. No Firebase. The `AuthGateway` port stays, so a real provider can be added later as one adapter. Data stays on the device, one database per user. |
| 2026-10-15 | **Milestones are vertical slices**: scaffold + auth → walk → turf → run and cycle → history → field validation.                                                                                                                                  |

## 10. Open questions

1. Who else will review the PoC report?
