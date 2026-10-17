# CityTurfer (formerly TurfTrack)

React Native mobile app that records walks, runs and bike rides on a real map and turns them into
the user's **turf**: every street you cover becomes a corridor of map cells that is yours
permanently and glows brighter with each repeat visit. The Turf Map (main feature) overlays all
tracks and turf. Also: reliable background GPS recording, stats, activity history.

## Stack (defaults — change here first if you change them)

- **Framework**: Expo (latest SDK), TypeScript strict, **development builds** (Expo Go cannot do
  background location)
- **Navigation**: expo-router (file-based, `app/`)
- **Auth**: **Mock** for the PoC: `MockAuthGateway` behind the `AuthGateway` port, single account
  `admin@cityturfer.com` / `admin1234`, session in `expo-secure-store`; one SQLite DB per user. No
  Firebase.
- **GPS**: `expo-location` + `expo-task-manager` (background updates, Android foreground service)
- **Maps**: `@maplibre/maplibre-react-native` + OpenFreeMap vector tiles (keyless); dark style on
  the Turf Map
- **Spatial index**: `h3-js` (Turf Cells = H3 res 11), behind the Territory `CellGrid` port
- **Storage**: `expo-sqlite`, local-first; no backend in v1
- **State**: `zustand` for live-session UI state; SQLite is the source of truth
- **Export**: GPX 1.1 via `expo-file-system` + `expo-sharing`
- **Tests**: Jest (`jest-expo`) + React Native Testing Library; Maestro for E2E

## Architecture — Domain-Driven Design (hard requirement)

Full design and **milestones (vertical slices M1–M7)** in `docs/poc-plan.md`; rules in the
`ddd-architecture` skill. Use the ubiquitous language (Recording Session, Fix, Track Point, Segment,
Activity…) from §2 of the plan in code and UI.

```
index.ts                             entry: imports the background task first, then expo-router/entry
src/app/                             expo-router screens (SDK 57 convention) — thin, compose context ui/ components
src/constants/                       shared constants (activity types, colours, map styles, tracking thresholds); imports nothing
src/ui-kit/                          theme hook, formatting, shared components, AppContext (auth + container)
src/wiring.ts                        platform-independent wiring of all contexts (used by app + tests)
src/dev/                             dev-only tools (demo history seeder)
src/shared-kernel/                   pure VOs + TrackAnalyzer (distance, splits, elevation, simplify)
src/contexts/identity/               AuthGateway port + MockAuthGateway (PoC), CurrentUser
  domain/ application/ infrastructure/ ui/ index.ts
src/contexts/recording/              CORE: RecordingSession aggregate, FixFilter, AutoPausePolicy, background task
  domain/ application/ infrastructure/ ui/ index.ts
src/contexts/activity-log/           Activity aggregate, history, detail, GPX import, (GPX export)
  domain/ application/ infrastructure/ ui/ index.ts
src/contexts/territory/              CORE: Claim aggregate, TurfStrengthPolicy, Territory projection, Turf Map
  domain/ application/ infrastructure/ ui/ index.ts
src/platform/                        SQLite, migrations, outbox, EventDispatcher, logger
src/composition-root.ts              lazy, React-free wiring (used by UI and headless task)
tools/                               dev tools (GPX generator, stats oracle, simulator GPS playback)
```

## Hard rules

- Dependency rule: `domain/` and `shared-kernel/` import nothing from react, react-native, expo-*,
  zustand or infrastructure. Contexts talk only via each other's `index.ts` and published events.
  Enforced by dependency-cruiser in `npm test`.
- `TaskManager.defineTask` lives at module top level in
  `src/contexts/recording/infrastructure/background-task.ts`, imported first by the root `index.ts`
  entry. It is a driving adapter: translate Fixes via the ACL and call the `IngestFixes` use case.
  Never rely on React state.
- Aggregate changes + domain events are saved in one SQLite transaction (outbox). Event handlers are
  idempotent.
- Shared-kernel maths is pure, unit-tested, SI units (metres, seconds, m/s); convert only in UI
  formatting. Numbers must match `tools/lib/geo.mjs`.
- Turf strength formula and defaults are identical in `src/contexts/territory/domain` and
  `tools/turf-preview.mjs`, pinned by `tools/fixtures/turf-vectors.json`.
- Activity types are exactly `walk | run | cycle`; per-type tuning lives in the `TrackingProfile`
  value object (Recording domain).
- Location data is personal data: no analytics on coordinates, no logging raw coordinates in
  production builds.
- Never claim background tracking works because tests pass. It needs a dev build on a device or
  simulator with simulated movement (see the `mobile-testing` skill).

## Commands

```bash
npx expo start --dev-client      # run JS against an installed dev build
npx expo run:ios | run:android   # build and install a dev build
npx tsc --noEmit                 # typecheck
npm test                         # architecture rules (depcruise) + jest
# Local quirks: watchman is disabled (broken Homebrew install) in jest + metro config; .npmrc uses legacy-peer-deps
# iOS needs Xcode 26.4+ (Expo SDK 57). Xcode's SPM hangs downloading MapLibre here, so run
#   tools/fetch-maplibre-ios.sh   once before prebuild — plugins/with-local-maplibre points SPM at vendor/maplibre-spm
maestro test e2e/                # E2E flows
node tools/gen-route.mjs --type run --km 5 > tools/fixtures/run-5k.gpx   # synthetic route
node tools/route-stats.mjs tools/fixtures/run-5k.gpx                     # reference stats
tools/sim-location.sh ios|android tools/fixtures/run-5k.gpx               # replay into a simulator
node tools/gen-history.mjs --days 120 --out tools/fixtures/history        # months of overlapping activities
node tools/turf-preview.mjs tools/fixtures/history --out /tmp/turf.html   # turf look + parameter tuning
```

## Git, releases & quality gates

- Branch policy: `docs/process/release-manager.md` — `feat/<domain>` → `scope/vX.Y.Z` →
  `release/vX.Y.Z` → `main`; PR titles `city-turfer - <branch>`; merge commits.
- Conventional Commits (commitlint + husky); CHANGELOG generated by `commit-and-tag-version` on
  `main` — never edit by hand.
- `npm run ci:quality` = Prettier check + ESLint + tsc + dependency rules + Jest. `npm run test:e2e`
  = Maestro suite in `e2e/` (iOS Simulator).

## Claude Code setup

- Skills (`.claude/skills/`): `brand-system`, `ddd-architecture`, `turf-territory`, `scaffold-app`,
  `add-feature`, `gps-tracking`, `route-metrics`, `route-storage`, `mobile-testing`.
- Agents (`.claude/agents/`): `rn-architect`, `location-engineer`, `mobile-ui-engineer`,
  `mobile-test-engineer`, `mobile-reviewer`, `brand-designer`.
