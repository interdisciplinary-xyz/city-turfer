# CityTurfer (formerly TurfTrack)

React Native mobile app that records walks, runs and bike rides on a real map and turns them into
the user's **turf**: every street you cover becomes a corridor of map cells that is yours
permanently and glows brighter with each repeat visit. The Turf Map (main feature) overlays all
tracks and turf. Also: reliable background GPS recording, stats, activity history.

## Stack (defaults — change here first if you change them)

- **Framework**: Expo (latest SDK), TypeScript strict, **development builds** (Expo Go cannot do
  background location)
- **Navigation**: expo-router (file-based, `apps/mobile/src/app/`)
- **Auth**: **Mock** for the PoC: `MockAuthGateway` behind the `AuthGateway` port, single account
  `admin@cityturfer.com` / `admin1234`, session in `expo-secure-store`; one SQLite DB per user. No
  Firebase.
- **GPS**: `expo-location` + `expo-task-manager` (background updates, Android foreground service)
- **Maps**: `@maplibre/maplibre-react-native` + OpenFreeMap vector tiles (keyless); dark style on
  the Turf Map
- **Spatial index**: `h3-js` (Turf Cells = H3 res 11), behind the Territory `CellGrid` port
- **Repo tooling**: pnpm (`node-linker=hoisted`, version pinned in `packageManager`) + Turborepo
  (`turbo.json`, `pnpm-workspace.yaml`): workspaces apps/* and packages/*; design in
  `docs/decisions/monorepo-turborepo-2026-10-18.md`
- **Web**: Next.js 16 (App Router, `output: 'export'`) in `apps/web`, hosted on Vercel; static
  showcase only (one hero section): no forms, cookies or third-party scripts. Languages via
  `next-intl` (`/en`, `/pl`; copy in `apps/web/messages/*.json`, no CMS)
- **Storage**: `expo-sqlite`, local-first; no backend in v1
- **State**: SQLite is the source of truth; live-session UI state is an in-memory `LiveSessionStore`
  (`apps/mobile/src/contexts/recording/infrastructure/live-session-store.ts`, read via
  `useSyncExternalStore`). No zustand.
- **Export**: GPX 1.1 export is planned (M7 stretch), not built; `expo-file-system` and
  `expo-sharing` are not installed yet
- **Tests**: Jest (`babel-preset-expo`, node environment, real SQL through `better-sqlite3` in
  `apps/mobile/src/test-support/node-database.ts`); Maestro for E2E

## Architecture — Domain-Driven Design (hard requirement)

Full design and **milestones (vertical slices M1–M7)** in `docs/poc-plan.md`; rules in the
`ddd-architecture` skill. Use the ubiquitous language (Recording Session, Fix, Track Point, Segment,
Activity…) from §2 of the plan in code and UI.

```
apps/mobile/                         the Expo app (package @cityturfer/mobile); its paths below are relative to it
  index.ts                           entry: imports the background task first, then expo-router/entry
  src/app/                           expo-router screens (SDK 57 convention) — thin, compose context ui/ components
  src/constants/                     shared constants (activity types, colours, map styles, tracking thresholds); imports nothing
  src/ui-kit/                        theme hook, formatting, shared components, AppContext (auth + container)
  src/wiring.ts                      platform-independent wiring of all contexts (used by app + tests)
  src/dev/                           dev-only tools (demo history seeder)
  src/shared-kernel/                 pure VOs + TrackAnalyzer (distance, splits, elevation, simplify)
  src/contexts/identity/             AuthGateway port + MockAuthGateway (PoC), User
    domain/ application/ infrastructure/ index.ts          (no ui/ layer)
  src/contexts/recording/            CORE: RecordingSession aggregate, FixFilter, AutoPausePolicy, background task
    domain/ application/ infrastructure/ ui/ index.ts
  src/contexts/activity-log/         Activity aggregate, history, detail, demo import, street-routed gap estimates
    domain/ application/ infrastructure/ ui/ index.ts contract.ts
  src/contexts/territory/            CORE: Claim aggregate, turf strength, Territory projection, Turf Map
    domain/ application/ infrastructure/ ui/ index.ts contract.ts
  src/contexts/achievements/         pure evaluation of achievements and the onboarding checklist
    domain/ infrastructure/ ui/ index.ts                  (infrastructure: onboarding dismissal flag)
  src/platform/                      SQLite, migrations, outbox + EventDispatcher, one-off jobs, diagnostics (no coordinates)
  src/composition-root.ts            lazy, React-free wiring (used by UI and headless task)
  modules/background-session/        native iOS module (CLBackgroundActivitySession + liveUpdates)
  plugins/                           config plugins (local MapLibre SPM, scene lifecycle)
  e2e/                               Maestro flows
  tools/                             mobile dev tools (GPX generator, stats oracle, simulator GPS playback, turf preview)
apps/web/                            Next.js landing page (@cityturfer/web): static export (out/), hosted on Vercel
packages/brand/                      @cityturfer/brand: colour tokens (turf strength ramp), name + copy, logo SVGs; plain TS
packages/config/                     @cityturfer/config: Prettier and tsconfig bases
packages/eslint-config/              @interdisciplinary/eslint-config (shared with empatalk): presets base, react, package + local-rules
packages/dev-toolbar/                @interdisciplinary/dev-toolbar (from empatalk): dev-only bottom toolbar for apps/web (request log, route map)
tools/                               repo-wide tools (docs audit, log audit, secret-file guard, release)
docs/  .github/  .husky/  .claude/   at the repo root
```

## Hard rules

- Dependency rule: `domain/` and `shared-kernel/` import nothing from react, react-native, expo-*,
  h3-js, MapLibre or infrastructure. Contexts talk only via each other's `index.ts` and published
  events. Enforced by dependency-cruiser in `pnpm test`.
- `TaskManager.defineTask` lives at module top level in
  `apps/mobile/src/contexts/recording/infrastructure/background-task.ts`, imported first by the
  app's `index.ts` entry. It is a driving adapter: translate Fixes via the ACL and call the
  `IngestFixes` use case. Never rely on React state.
- Aggregate changes + domain events are saved in one SQLite transaction (outbox). Event handlers are
  idempotent.
- Shared-kernel maths is pure, unit-tested, SI units (metres, seconds, m/s); convert only in UI
  formatting. Numbers must match `apps/mobile/tools/lib/geo.mjs`.
- Turf strength formula and defaults are identical in `apps/mobile/src/contexts/territory/domain`
  and `apps/mobile/tools/turf-preview.mjs`, pinned by
  `apps/mobile/tools/fixtures/turf-vectors.json`.
- Brand colours and copy come from `@cityturfer/brand` (`apps/mobile/src/constants/colors.ts`
  re-exports them); never hard-code brand hex in either app.
- Lint (`@interdisciplinary/eslint-config`): types and SCREAMING_SNAKE constants live in a colocated
  `<file>.constants.ts`, not in `.tsx` components (Expo Router screens in `apps/mobile/src/app/` are
  exempt: every file there becomes a route); `curly: all`; one import per module.
- Activity types are exactly `walk | run | cycle`; per-type tuning lives in the `TrackingProfile`
  value object (Recording domain).
- Location data is personal data: no analytics on coordinates, no logging raw coordinates in
  production builds.
- Never claim background tracking works because tests pass. It needs a dev build on a device or
  simulator with simulated movement (see the `mobile-testing` skill).

## Commands

```bash
pnpm install                     # all workspaces (root + apps/*)
pnpm start                       # Metro for an installed dev build (= expo start --dev-client in apps/mobile)
pnpm ios | pnpm android          # build and install a dev build (expo run:*)
pnpm run typecheck               # tsc in every workspace (turbo)
pnpm test                        # dependency rules (depcruise) + Jest + tool tests (turbo)
pnpm run build                   # web static export (apps/web/out) via turbo
pnpm run web:dev                 # landing page at https://cityturfer.local (portless + server.mjs, dev toolbar)
pnpm -C apps/mobile run android:build     # Android APK on EAS (docs/operations/android-release.md)
pnpm -C apps/mobile exec expo install <pkg>                     # add a native dependency to the app
# Local quirks: watchman is disabled (broken Homebrew install) in jest + metro config; pnpm with
#   node-linker=hoisted (.npmrc). iOS needs Xcode 26.4+ (Expo SDK 57). Xcode's SPM hangs downloading
#   MapLibre here, so run apps/mobile/tools/fetch-maplibre-ios.sh once before prebuild —
#   apps/mobile/plugins/with-local-maplibre points SPM at apps/mobile/vendor/maplibre-spm
pnpm run test:e2e                # Maestro flows in apps/mobile/e2e/
node apps/mobile/tools/gen-route.mjs --type run --km 5 > apps/mobile/tools/fixtures/run-5k.gpx   # synthetic route
node apps/mobile/tools/route-stats.mjs apps/mobile/tools/fixtures/run-5k.gpx                     # reference stats
apps/mobile/tools/sim-location.sh ios|android apps/mobile/tools/fixtures/run-5k.gpx              # replay into a simulator
node apps/mobile/tools/gen-history.mjs --days 120                                               # months of overlapping activities
node apps/mobile/tools/turf-preview.mjs apps/mobile/tools/fixtures/history --out /tmp/turf.html  # turf look + parameter tuning
```

## Git, releases & quality gates

- Branch policy: `docs/process/release-manager.md` — `feat/<domain>` → `scope/vX.Y.Z` →
  `release/vX.Y.Z` → `main`; PR titles `city-turfer - <branch>`; merge commits.
- Conventional Commits (commitlint + husky); CHANGELOG generated by `commit-and-tag-version` on
  `main` — never edit by hand.
- `pnpm run ci:quality` = Prettier check + ESLint + tsc + dependency rules + Jest.
  `pnpm run test:e2e` = Maestro suite in `apps/mobile/e2e/` (iOS Simulator).

## Claude Code setup

- Skills (`.claude/skills/`): `brand-system`, `ddd-architecture`, `turf-territory`, `scaffold-app`,
  `add-feature`, `gps-tracking`, `route-metrics`, `route-storage`, `mobile-testing`, `web-motion`.
- Agents (`.claude/agents/`): `rn-architect`, `location-engineer`, `mobile-ui-engineer`,
  `mobile-test-engineer`, `mobile-reviewer`, `brand-designer`, `web-engineer` (apps/web).
- Commands (`.claude/commands/`): `audit-docs` (`/audit-docs`).

## Docs

- Every doc in `docs/` carries frontmatter (`status`, `verified`, `owner`, `scope`, `summary`);
  rules in `docs/process/docs-conventions.md`. All files are kebab-case.
- `pnpm run audit:docs` reports dead paths, broken links, frontmatter gaps and probe drift;
  `pnpm run audit:docs -- --write-index` regenerates `docs/INDEX.md`. Never hand-write a count that
  a probe can derive.
