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
  `admin@cityturfer.com` / `admin1234`, plus `demo@cityturfer.com` / `demo1234` for screenshots
  (first sign-in fills it with Gdańsk demo data: `apps/mobile/src/dev/gdansk-demo.ts`, routes from
  `apps/mobile/tools/gen-gdansk-routes.mjs`); session in `expo-secure-store`; one SQLite DB per
  user. No Firebase.
- **GPS**: `expo-location` + `expo-task-manager` (background updates, Android foreground service)
- **Maps**: `@maplibre/maplibre-react-native` + OpenFreeMap vector tiles (keyless); dark style on
  the Turf Map
- **Apple Health**: `@kingstinct/react-native-healthkit` (Nitro) behind the Health Sync
  `HealthStore` port; iOS only (`apps/mobile/react-native.config.js` keeps it out of Android).
  Import of walks, hikes, runs, rides with routes; export of recordings. Design:
  `docs/decisions/apple-health-2026-10-18.md`
- **Design system**: tokens in `@cityturfer/brand` (`packages/brand/src/tokens.ts`; the web gets
  them as CSS variables from `cssVariables()`; brand typefaces Big Shoulders Display + Barlow
  (`docs/decisions/brand-typography-2026-10-22.md`), bundled in the app via the `expo-font` plugin;
  the wordmark is outlined Anton (outline source only, never bundled); brand foundations in
  `docs/decisions/brand-foundations-2026-10-20.md`), React Native components in `@cityturfer/ui`
  (`packages/ui`, peer dependencies only, no native code), one Storybook in `apps/storybook`
  (Storybook 10 + react-native-web, port 6006; static build, Vercel project pending). Design:
  `docs/decisions/design-system-2026-10-19.md`
- **App languages** (in progress): English (source) and Polish via `use-intl` (ICU, the website's
  message syntax), catalogue `apps/mobile/messages/<locale>/<namespace>.json`, never raw text in UI
  (`mobile-i18n` skill). Design: `docs/decisions/mobile-i18n-2026-10-23.md`
- **Spatial index**: `h3-js` (Turf Cells = H3 res 11), behind the Territory `CellGrid` port; the
  adapter is `@cityturfer/core/h3`, the only place h3-js is declared (pinned exactly, one copy)
- **Core**: `@cityturfer/core` (`packages/core`) holds the shared kernel, core constants and the
  domain + application layers of Territory, Activity Log, Achievements and Identity, so the phone
  and the API run the same rules. TS source, no React/Expo/native code; the app's old import paths
  are re-export shims. Recording and Health Sync stay in the app (device only)
- **Repo tooling**: pnpm (`node-linker=hoisted`, version pinned in `packageManager`) + Turborepo
  (`turbo.json`, `pnpm-workspace.yaml`): workspaces apps/* and packages/*; design in
  `docs/decisions/monorepo-turborepo-2026-10-18.md`
- **Web**: Next.js 16 (App Router, `output: 'export'`) in `apps/web`, hosted on Vercel; static
  showcase (hero, APK download, waitlist): public pages set no cookies, make no API calls and load
  no third-party scripts; the waitlist form posts emails straight to Brevo (double opt-in, personal
  data). Signed-in portal under `/[locale]/account`: one strictly necessary session cookie through
  the `/api/v1` route to the API (`docs/decisions/web-portal-2026-10-22.md`). Languages via
  `next-intl` (`/en`, `/pl`; copy in `apps/web/messages/*.json`, no CMS). Light website and portal
  so the app's dark screens stand out (`WEB_SCHEME`, white header via `HEADER_SCHEME`, day wordmark;
  turf pieces and hero phones stay dark through `APP_SCHEME`; Swagger and Storybook keep
  `SITE_SCHEME`, dark; `docs/decisions/brand-light-website-2026-10-29.md`)
- **Admin** (scaffold, not deployed): Payload CMS 3.91 on Next 16 in `apps/admin` (same next/react
  pins as apps/web). Payload holds only staff accounts, in its **own** Postgres database
  (`PAYLOAD_DATABASE_URL`, never the API's), schema via committed migrations (`push: false`);
  GraphQL off, every access rule of its collections explicit, no document locks, public first-user
  form and forgot-password closed (staff come from `staff:create`); missing env fails closed. User
  data only through the API's audited `/internal/admin` routes (not built). Local login without MFA:
  not deployable until decision AD3 (`docs/plans/admin-portal-2026-10-22.md`, with the
  portals-planning change)
- **Storage**: `expo-sqlite`, local-first; the phone stays the source of truth. Optional one-way
  cloud backup to `apps/api` (`apps/mobile/src/contexts/cloud-backup`), only after the user's
  consent (Info › Cloud backup); device token in the secure store
- **API** (v0.8.0, one-way backup live): `apps/api`, Hono on Vercel (`fra1`, project
  `city-turfer-api`, esbuild bundle), routes declared with zod + `@hono/zod-openapi` into a
  generated OpenAPI 3.1 spec (`apps/api/openapi.json`), Swagger UI at
  https://cityturfer.local/swagger. Sync-first contract (versions, If-Match, tombstones, one changes
  feed); Neon Postgres + Drizzle (PGlite in tests), device tokens until Better Auth. Design:
  `docs/decisions/api-sync-2026-10-20.md` (contract),
  `docs/decisions/api-device-tokens-2026-10-20.md` (backup, tokens),
  `docs/decisions/api-2026-10-20.md` (stack); runbook `docs/operations/api-deploy.md`
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
  src/constants/                     app constants (labels, colours, map styles) + re-exports of core constants; leaf
  src/ui-kit/                        theme hook, formatting, shared components, AppContext (auth + container)
  src/wiring.ts                      platform-independent wiring of all contexts (used by app + tests)
  src/dev/                           dev-only tools (demo history seeder)
  src/shared-kernel/index.ts         re-export shim of @cityturfer/core/shared-kernel
  src/contexts/identity/             MockAuthGateway (PoC), session stores, Account tab; domain + use cases in core
    infrastructure/ ui/ index.ts (shim)
  src/contexts/recording/            CORE: RecordingSession aggregate, FixFilter, AutoPausePolicy, background task
    domain/ application/ infrastructure/ ui/ index.ts
  src/contexts/activity-log/         history, detail, SQLite repo, OSM gap router; domain + use cases in core
    infrastructure/ ui/ index.ts contract.ts (shims)
  src/contexts/territory/            Turf Map, SQLite projection, Home City repo; domain + use cases in core
    infrastructure/ ui/ index.ts contract.ts (shims)
  src/contexts/health-sync/          Apple Health import/export (ACL: "workout" stays here), links + anchor
    domain/ application/ infrastructure/ ui/ index.ts contract.ts
  src/contexts/cloud-backup/         opt-in one-way backup to apps/api: consent, queue (migration v8), uploads
    domain/ application/ infrastructure/ ui/ index.ts
  src/contexts/achievements/         cards + onboarding dismissal flag; the pure evaluation is in core
    infrastructure/ ui/ index.ts (shim)
  src/platform/                      SQLite, migrations, outbox + EventDispatcher, one-off jobs, diagnostics (no coordinates)
  src/composition-root.ts            lazy, React-free wiring (used by UI and headless task)
  modules/background-session/        native iOS module (CLBackgroundActivitySession + liveUpdates)
  plugins/                           config plugins (local MapLibre SPM, scene lifecycle)
  e2e/                               Maestro flows
  tools/                             mobile dev tools (GPX generator, stats oracle, simulator GPS playback, turf preview)
apps/web/                            Next.js landing page (@cityturfer/web): static export (out/), hosted on Vercel
apps/admin/                          @cityturfer/admin: staff admin portal (Payload CMS on Next), own database, staff accounts only
apps/storybook/                      @cityturfer/storybook: one Storybook for @cityturfer/ui (react-native-web) and apps/web pieces
apps/api/                            @cityturfer/api: HTTP API (Hono on Vercel), /v1 routes over the app's use cases, OpenAPI + Swagger
packages/core/                       @cityturfer/core: shared kernel, core constants, domain + application of territory,
                                     activity-log, achievements, identity (src/contexts/<ctx>/{index,ports}.ts); H3 adapter in src/h3
packages/brand/                      @cityturfer/brand: colour + design tokens (turf strength ramp, spacing, type, themes, cssVariables), copy, logo SVGs; plain TS
packages/ui/                         @cityturfer/ui: React Native design-system components (Button, Card, Stat, Badge, ActivityRow, TurfLegend)
packages/config/                     @cityturfer/config: Prettier and tsconfig bases
packages/eslint-config/              @interdisciplinary/eslint-config (shared with empatalk): presets base, react, package + local-rules
packages/dev-toolbar/                @interdisciplinary/dev-toolbar (from empatalk): dev-only bottom toolbar for apps/web (request log, route map)
tools/                               repo-wide tools (docs audit, log audit, secret-file guard, release)
docs/  .github/  .husky/  .claude/   at the repo root
```

## Hard rules

- Dependency rule: `domain/` and `shared-kernel/` import nothing from react, react-native, expo-*,
  h3-js, MapLibre or infrastructure. Contexts talk only via each other's `index.ts` and published
  events. `packages/core` imports no framework, native module, UI package or app at all; only its
  `packages/core/src/h3/` loads h3-js. The app uses core through its entries only
  (`@cityturfer/core/<ctx>`; `/<ctx>/ports` just for that context's own adapters). Enforced by
  dependency-cruiser in each workspace's `arch` script (`pnpm test`).
- `TaskManager.defineTask` lives at module top level in
  `apps/mobile/src/contexts/recording/infrastructure/background-task.ts`, imported first by the
  app's `index.ts` entry. It is a driving adapter: translate Fixes via the ACL and call the
  `IngestFixes` use case. Never rely on React state.
- Aggregate changes + domain events are saved in one SQLite transaction (outbox). Event handlers are
  idempotent.
- Shared-kernel maths is pure, unit-tested, SI units (metres, seconds, m/s); convert only in UI
  formatting. Numbers must match `apps/mobile/tools/lib/geo.mjs`.
- Turf strength formula and defaults are identical in `packages/core/src/contexts/territory/domain`
  and `apps/mobile/tools/turf-preview.mjs`, pinned by
  `apps/mobile/tools/fixtures/turf-vectors.json`.
- `@cityturfer/ui` stays pure React Native with peer dependencies only (no Expo, MapLibre, HealthKit
  or other native modules), so it never changes the runtime fingerprint; check the fingerprint after
  touching it (`design-system` skill).
- Brand colours and copy come from `@cityturfer/brand` (`apps/mobile/src/constants/colors.ts`
  re-exports them); never hard-code brand hex in either app.
- Lint (`@interdisciplinary/eslint-config`): types and SCREAMING_SNAKE constants live in a colocated
  `<file>.constants.ts`, not in `.tsx` components (Expo Router screens in `apps/mobile/src/app/` are
  exempt: every file there becomes a route); `curly: all`; one import per module.
- Activity types are exactly `walk | run | cycle`; per-type tuning lives in the `TrackingProfile`
  value object (Recording domain).
- Location data is personal data: no analytics on coordinates, no logging raw coordinates in
  production builds. Apple Health data likewise: never logged or analysed; it reaches our API only
  as imported Activities, and only when the user turns on "Include Apple Health workouts" in cloud
  backup. HealthKit only in the foreground.
- Never claim background tracking works because tests pass. It needs a dev build on a device or
  simulator with simulated movement (see the `mobile-testing` skill).

## Commands

```bash
pnpm install                     # all workspaces (root + apps/*)
pnpm start                       # Metro for an installed dev build (= expo start --dev-client in apps/mobile)
pnpm ios | pnpm android          # build and install a dev build (expo run:*)
pnpm run typecheck               # tsc in every workspace (turbo)
pnpm test                        # dependency rules (depcruise) + Jest + tool tests (turbo)
pnpm run build                   # web static export (apps/web/out), admin and API builds via turbo
pnpm run web:dev                 # landing page at https://cityturfer.local (portless + server.mjs, dev toolbar)
pnpm --filter @cityturfer/api dev                       # API on :8787 (PGlite + token dev-token without env)
#   …on PGlite also the app's mock accounts: admin@cityturfer.com and demo@cityturfer.com sign in to
#   the web portal with code 000000; demo@ gets the Gdańsk demo history (apps/api/src/dev/mock-accounts.ts)
pnpm --filter @cityturfer/api run db:generate           # SQL migration from apps/api/src/db/schema.ts (commit apps/api/drizzle/)
DATABASE_URL=… pnpm --filter @cityturfer/api run db:migrate   # apply migrations to Neon (docs/operations/api-deploy.md)
pnpm --filter @cityturfer/api run token:new -- <userId>       # device token + API_TOKENS entry (stopgap auth)
pnpm start:dev                   # web:dev, building Storybook first if storybook-static is missing
pnpm cache:clean                 # delete node_modules, .turbo, .next, out, .expo (then pnpm install)
pnpm --filter @cityturfer/storybook dev     # Storybook at http://localhost:6006 (app components + website pieces)
pnpm --filter @cityturfer/storybook build   # static Storybook in apps/storybook/storybook-static
#   …also served by `pnpm run web:dev` at https://cityturfer.local/storybook (rebuild to refresh)
pnpm --filter @cityturfer/api dev           # API on http://localhost:8787 (Swagger at /swagger); web:dev proxies /api/* to it
pnpm --filter @cityturfer/api run openapi   # regenerate apps/api/openapi.json after changing routes (a test checks it)
pnpm --filter @cityturfer/admin dev         # admin on :3100, at https://cityturfer.local/admin through web:dev (needs PAYLOAD_DATABASE_URL, PAYLOAD_SECRET, ADMIN_URL: apps/admin/.env.example)
pnpm --filter @cityturfer/admin migrate     # apply admin's Payload migrations (migrate:create after a collection change)
pnpm --filter @cityturfer/admin generate    # payload-types.ts + importMap.js after a config change (ci:quality checks they are current)
read -s STAFF_PASSWORD && export STAFF_PASSWORD && pnpm --filter @cityturfer/admin staff:create -- --email <e> --roles staff-admin   # a staff account
pnpm -C apps/mobile run android:build     # Android APK on EAS (docs/operations/android-release.md)
pnpm -C apps/mobile exec expo install <pkg>                     # add a native dependency to the app
# Local quirks: watchman is disabled (broken Homebrew install) in jest + metro config; pnpm with
#   node-linker=hoisted (.npmrc). iOS needs Xcode 26.4+ (Expo SDK 57). Xcode's SPM hangs downloading
#   MapLibre here, so run apps/mobile/tools/fetch-maplibre-ios.sh once before prebuild —
#   apps/mobile/plugins/with-local-maplibre points SPM at apps/mobile/vendor/maplibre-spm
pnpm run audit:brand             # every brand surface draws from @cityturfer/brand (tools/brand/surfaces.mjs)
pnpm run brand:snapshot          # screenshots of every surface + contact sheet (needs web:dev, API, simulator)
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
- `pnpm run ci:quality` = Prettier check + ESLint + tsc + dependency rules + Jest + audits
  (`audit:logs`, `audit:harness`, `audit:i18n`: same keys, valid ICU and full plurals in every
  locale of the app and website catalogues; `audit:brand`: every surface in
  `tools/brand/surfaces.mjs` draws from `@cityturfer/brand`). `pnpm run test:e2e` = Maestro suite in
  `apps/mobile/e2e/` (iOS Simulator).

## Claude Code setup

- Skills (`.claude/skills/`): `brand-system`, `ddd-architecture`, `turf-territory`, `scaffold-app`,
  `add-feature`, `gps-tracking`, `route-metrics`, `route-storage`, `mobile-testing`, `apple-health`,
  `web-motion`, `design-system`, `api-design`, `product-knowledge` (what the product is; docs in
  `docs/product/`), `product-discovery`, `product-strategy`, `product-launch`, `verify-change`
  (prove a change before calling it done), `ship-branch` (commit, push, PR per the branch flow),
  `ai-harness` (this setup), `mobile-i18n` (app languages, Polish glossary), `web-portal` (signed-in
  portal in apps/web), `brand-surfaces` (one brand across app, site, portal, Swagger, Storybook).
- Agents (`.claude/agents/`): `rn-architect`, `location-engineer`, `mobile-ui-engineer`,
  `mobile-test-engineer`, `qa-engineer` (release QA and acceptance testing across all apps),
  `mobile-reviewer`, `brand-designer`, `health-engineer` (Apple Health), `web-engineer` (apps/web
  landing and hosting), `portal-engineer` (signed-in web portal), `api-engineer` (back end:
  apps/api, server data, sync), `product-manager` (the Product Owner persona; talk to it as the main
  session with the agent flag), `harness-engineer` (skills, agents, hooks, audits), `docs-engineer`
  (release docs: scope and release PR bodies, session log, CHANGELOG preview, stale docs). When the
  founder says **"update all docs"**, start `docs-engineer` (worktree isolation) before scope →
  release or release → main.
- Commands (`.claude/commands/`): `audit-docs` (`/audit-docs`).
- Hooks (`.claude/settings.json`, rules in `tools/harness/hook-rules.mjs`): deny edits that break
  the dependency rule, touch `CHANGELOG.md`, secret files or generated native folders; deny push to
  main, force-push to scope/release, hand-made tags, `--no-verify`, wrong PR title/base; ask before
  merges and copying device data; flag unguarded logs and hard-coded brand hex after edits; Prettier
  on save. A hook block is a rule doing its job: fix the cause, never route around it.
- `pnpm run audit:harness` (in `ci:quality`) checks the harness still matches the code.

## Docs

- Every doc in `docs/` carries frontmatter (`status`, `verified`, `owner`, `scope`, `summary`);
  rules in `docs/process/docs-conventions.md`. All files are kebab-case.
- `pnpm run audit:docs` reports dead paths, broken links, frontmatter gaps and probe drift;
  `pnpm run audit:docs -- --write-index` regenerates `docs/INDEX.md`. Never hand-write a count that
  a probe can derive.
