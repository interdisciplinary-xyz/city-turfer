# CityTurfer

[![CI](https://github.com/interdisciplinary-xyz/city-turfer/actions/workflows/ci.yml/badge.svg)](https://github.com/interdisciplinary-xyz/city-turfer/actions/workflows/ci.yml)

<p align="center">
  <img src="packages/brand/svg/mark.svg" alt="CityTurfer" width="160">
</p>

**Surf your city. Own your streets.** A mobile app that records walks, runs and rides on a real map
and turns every street you cover into your **turf**: a corridor of map cells that stays yours and
glows brighter each time you come back.

| You do                       | CityTurfer does                                                                |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Walk, run or ride            | Records the route in the background, with auto-pause and recovery after a kill |
| Finish the activity          | Claims the streets you covered as cells on an H3 hexagon grid (~50 m)          |
| Come back to the same street | Makes those cells stronger: the Turf Map glows brighter where you live         |
| Open the Record tab          | Shows your turf under the live map, so you can head for streets you haven't    |
| Pick your city               | Centres the maps on your Home City                                             |
| Use Apple Health (iOS)       | Imports walks, hikes, runs and rides with routes; saves recordings back        |

**Not for:** competing for territory with other people, training plans or heart-rate analysis.
CityTurfer is single-player and local-first: the phone is the source of truth.

> [!NOTE] Status: **v0.10.0 released** (proof of concept: iOS dev builds, Android APK), **v0.11.0 in
> progress**. Local profiles `admin@cityturfer.com` / `admin1234` and `demo@cityturfer.com` /
> `demo1234` (Gdańsk demo data); any other e-mail signs in with an e-mailed code against the API.
> Data stays on the phone unless you turn on **Cloud backup** (opt-in, one way, signed-in account).
> The website has a signed-in account page (Slice 0: what the server holds, export, delete). Not on
> the App Store or Google Play yet.

---

## Contents

1. [Stack](#stack)
2. [Architecture](#architecture)
3. [Quick start](#quick-start)
4. [Testing](#testing)
5. [Releases and OTA updates](#releases-and-ota-updates)
6. [Documentation](#documentation)
7. [License](#license)

---

## Stack

| App (`apps/mobile`)                               | API (`apps/api`)                  | Web and design                     | Quality and tooling                       |
| ------------------------------------------------- | --------------------------------- | ---------------------------------- | ----------------------------------------- |
| [Expo SDK 57][expo] (development builds)          | [Hono][hono] on [Vercel][vercel]  | [Next.js 16][next] (static export) | [Jest][jest] · [Vitest][vitest]           |
| [React Native 0.86][react-native]                 | [zod 4][zod] → OpenAPI 3.1        | [next-intl][next-intl] (en, pl)    | [Maestro][maestro] (E2E)                  |
| [TypeScript][typescript] (strict)                 | [Drizzle][drizzle] + [Neon][neon] | [GSAP][gsap]                       | [dependency-cruiser][dependency-cruiser]  |
| [expo-router][expo-router]                        | Swagger UI                        | [Storybook 10][storybook] (RN web) | [ESLint][eslint] · [Prettier][prettier]   |
| [expo-location][expo-location] + task manager     |                                   | Big Shoulders Display + Barlow     | [Turborepo][turborepo] · [pnpm][pnpm]     |
| [MapLibre][maplibre] + [OpenFreeMap][openfreemap] |                                   | [Payload 3.91][payload] (admin)    | [Husky][husky] · [Commitlint][commitlint] |
| [H3][h3] (`h3-js` in `@cityturfer/core`)          |                                   |                                    | [EAS Update][eas-update]                  |
| [expo-sqlite][expo-sqlite]                        |                                   |                                    |                                           |
| [HealthKit][healthkit] (iOS)                      |                                   |                                    |                                           |
| [use-intl][use-intl] (en, pl)                     |                                   |                                    |                                           |

[expo]: https://docs.expo.dev/
[react-native]: https://reactnative.dev/
[typescript]: https://www.typescriptlang.org/
[expo-router]: https://docs.expo.dev/router/introduction/
[expo-location]: https://docs.expo.dev/versions/latest/sdk/location/
[maplibre]: https://maplibre.org/
[openfreemap]: https://openfreemap.org/
[h3]: https://h3geo.org/
[expo-sqlite]: https://docs.expo.dev/versions/latest/sdk/sqlite/
[healthkit]: https://github.com/kingstinct/react-native-healthkit
[hono]: https://hono.dev/
[vercel]: https://vercel.com/
[zod]: https://zod.dev/
[drizzle]: https://orm.drizzle.team/
[neon]: https://neon.tech/
[next]: https://nextjs.org/
[next-intl]: https://next-intl.dev/
[gsap]: https://gsap.com/
[payload]: https://payloadcms.com/
[use-intl]: https://next-intl.dev/docs/environments/core-library
[storybook]: https://storybook.js.org/
[jest]: https://jestjs.io/
[vitest]: https://vitest.dev/
[maestro]: https://maestro.dev/
[dependency-cruiser]: https://github.com/sverweij/dependency-cruiser
[eslint]: https://eslint.org/
[prettier]: https://prettier.io/
[turborepo]: https://turborepo.com/
[pnpm]: https://pnpm.io/
[husky]: https://typicode.github.io/husky/
[commitlint]: https://commitlint.js.org/
[eas-update]: https://docs.expo.dev/eas-update/introduction/

Runtime: **Node 22.15.1** (`.nvmrc`), pnpm 10.22.0 (`packageManager`), Xcode 26.4+ for iOS.
Development builds only (Expo Go can't do background location). JS changes ship over the air on EAS
channel `production`; native changes need a new build.

---

## Architecture

The repo is a pnpm + Turborepo monorepo
([decision](./docs/decisions/monorepo-turborepo-2026-10-18.md)):

| Path                      | What                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/mobile/`            | The Expo app (`@cityturfer/mobile`): app code, native module, config plugins, Maestro flows, mobile dev tools      |
| `apps/api/`               | HTTP API (`@cityturfer/api`): Hono on Vercel (`fra1`), `/v1` routes, generated `openapi.json`, backup, server turf |
| `apps/web/`               | Website (`@cityturfer/web`): Next.js static export on Vercel, English + Polish, waitlist, signed-in account page   |
| `apps/admin/`             | Staff admin (`@cityturfer/admin`): Payload CMS scaffold, own database, staff accounts only, not deployed           |
| `apps/storybook/`         | One Storybook (`@cityturfer/storybook`) for `@cityturfer/ui` and website pieces                                    |
| `packages/core/`          | `@cityturfer/core`: shared kernel, the domain + use cases shared by the app and the API, demo-history generator    |
| `packages/brand/`         | `@cityturfer/brand`: design tokens (turf strength ramp, themes, type), copy, logo SVGs, brand fonts                |
| `packages/ui/`            | `@cityturfer/ui`: pure React Native components (Button, Card, Stat, Badge, ActivityRow, TurfLegend)                |
| `packages/config/`        | `@cityturfer/config`: Prettier and tsconfig bases                                                                  |
| `packages/eslint-config/` | `@interdisciplinary/eslint-config`: ESLint presets and local rules, shared with empatalk                           |
| `packages/dev-toolbar/`   | `@interdisciplinary/dev-toolbar`: dev-only toolbar for the website (request log, route map), shared with empatalk  |
| `tools/`                  | Repo-wide tools: docs, log, i18n and harness audits, sync-chain runner, secret-file guard, hook rules, release     |
| `docs/`                   | Documentation, indexed in [`docs/INDEX.md`](./docs/INDEX.md)                                                       |

Domain-Driven Design is a hard requirement. Each bounded context has `domain/`, `application/`,
`infrastructure/` and (in the app) `ui/` layers and a public `index.ts`. Contexts talk only through
each other's `index.ts` and published domain events. Aggregate changes and their events are saved in
one SQLite transaction (outbox), and event handlers are idempotent. dependency-cruiser enforces the
rules in `pnpm run test:arch`: domain code imports no React, Expo, h3-js, MapLibre or
infrastructure, and no context reaches into another's layers. Full design:
[PoC plan](./docs/poc-plan.md) and [domain architecture](./docs/engineering/domain-architecture.md);
rules: [`ddd-architecture` skill](./.claude/skills/ddd-architecture/SKILL.md).

### Bounded contexts

| Context      | Domain and use cases        | Purpose                                                                        |
| ------------ | --------------------------- | ------------------------------------------------------------------------------ |
| Identity     | `packages/core`             | `AuthGateway` port; mock sign-in for the PoC; one SQLite DB per user           |
| Recording    | `apps/mobile` (device only) | **Core.** Recording Session, Fix Filter, auto-pause, background task, recovery |
| Activity Log | `packages/core`             | Activities, history, detail, splits, demo import, street-routed gap estimates  |
| Territory    | `packages/core`             | **Core.** Claims, turf cells (H3 res 11), strength, Turf Map, Home City        |
| Achievements | `packages/core`             | Pure evaluation of achievements and the onboarding checklist                   |
| Health Sync  | `apps/mobile` (iOS only)    | Apple Health import and export, links and anchor so nothing is imported twice  |
| Cloud Backup | `apps/mobile`               | Opt-in, one-way backup of activities to the API; queue, consent, device token  |

Adapters (SQLite repositories, Expo, MapLibre, HealthKit, secure store) and UI stay in
`apps/mobile/src/contexts/<context>/`; the app imports core through `@cityturfer/core/<context>`.

Shared code in the app:

| Path                               | Purpose                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `apps/mobile/src/constants`        | Labels, colours, map styles, API settings; re-exports core constants            |
| `apps/mobile/src/platform`         | SQLite, migrations (v8), outbox and event dispatcher, one-off jobs, diagnostics |
| `apps/mobile/src/ui-kit`           | Theme hook, formatting, shared components, app context, Me menu                 |
| `apps/mobile/src/composition-root` | Lazy, React-free wiring used by the UI and the headless background task         |
| `apps/mobile/modules/`             | Native module `background-session` (iOS `CLBackgroundActivitySession`)          |

The background location task is defined at module top level in
`apps/mobile/src/contexts/recording/infrastructure/background-task.ts` and imported first by
`index.ts`. It translates fixes through the anti-corruption layer and calls the `IngestFixes` use
case; it never relies on React state and never touches the network.

### Screens

expo-router, file-based under `apps/mobile/src/app/`. Screens are thin: they compose context `ui/`
components and hooks.

| Route                      | Screen                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `(tabs)/index`             | Dashboard (start tab): greeting, onboarding checklist, this week, recent, achievements |
| `(tabs)/turf`              | Turf Map: tracks, glowing turf, walk/run/ride filter, Home City chip                   |
| `(tabs)/record`            | Record (raised centre tab): type picker, live map and stats, turf toggle, city chip    |
| `(tabs)/stats`             | This week, 8-week chart, turf totals, all-time per type                                |
| `(tabs)/me`                | Opens the Me drawer: Profile, Account, City, Info                                      |
| `history`                  | Activity history (from Dashboard and Stats)                                            |
| `activity/[id]`            | Activity detail: map, stats, splits, turf gained, rename, delete                       |
| `profile` · `achievements` | Profile with totals; achievements with progress                                        |
| `city`                     | Home City picker (catalogue of Polish and European cities, works offline)              |
| `account`                  | Name, e-mail, optional password, data export, sign out, delete account                 |
| `info`                     | Version, updates, language, data note, Apple Health and Cloud backup cards, demo data  |
| `sign-in`                  | E-mailed code or account password; the local `admin` and `demo` profiles               |

### Scripts

Everyday commands from the root `package.json` (they run the workspaces' scripts through Turborepo
or `pnpm --filter`); `pnpm run` is authoritative.

| Name                        | Description                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `start`                     | Metro for an installed development build                                            |
| `ios` / `android`           | Build and install a development build                                               |
| `test:types` / `typecheck`  | `tsc --noEmit` in every workspace                                                   |
| `test:arch`                 | Dependency rules (dependency-cruiser) in the app, core, web and admin               |
| `test:unit`                 | Jest (app, core, ui, brand), Vitest (API, web, admin, shared packages), tool tests  |
| `test`                      | `test:arch` + unit and tool tests                                                   |
| `test:chain`                | Sync chain: phone → API (PGlite) → web portal scenarios (`tools/chain/run.mjs`)     |
| `test:e2e`                  | Maestro suite on the booted iOS Simulator (`apps/mobile/e2e/run.sh`)                |
| `build`                     | Website static export, static Storybook, the admin and the API bundle               |
| `web:dev`                   | Website at `https://cityturfer.local` with the dev toolbar, Swagger at `/swagger`   |
| `start:dev`                 | `web:dev`, building Storybook first if it isn't built                               |
| `cache:clean`               | Delete `node_modules`, `.turbo`, `.next`, `out` and `.expo` (then `pnpm install`)   |
| `standard` / `standard:fix` | Prettier + ESLint, check or apply                                                   |
| `ci:quality`                | Full local gate: `standard`, types, arch, unit, builds, log/harness/i18n/e2e audits |
| `audit:docs`                | Docs audit: dead paths, broken links, frontmatter, probes                           |
| `audit:i18n`                | App and website copy: same keys in every locale, valid ICU messages                 |
| `audit:harness`             | Claude Code setup matches the code (skills, agents, hooks, `CLAUDE.md`)             |
| `release`                   | `commit-and-tag-version` (run by CI on `main`, never by hand)                       |

API commands (`pnpm --filter @cityturfer/api run <name>`): `dev` (http://localhost:8787, Swagger at
`/swagger`), `openapi` (regenerate `openapi.json`; a test fails when it's stale), `db:generate` (SQL
migration from the schema), `db:migrate` (by hand, never in a Vercel build), `token:new -- <user>`
(a device token), `turf:backfill` and `turf:rebuild` (server turf). Deploy:
[API deploy runbook](./docs/operations/api-deploy.md). Admin commands (`migrate`, `generate`,
`staff:create`) are in `CLAUDE.md`.

> [!IMPORTANT] Tests passing doesn't prove background tracking works. It needs a development build
> on a device, or a simulator with replayed movement (`apps/mobile/tools/sim-location.sh`). See the
> [`mobile-testing` skill](./.claude/skills/mobile-testing/SKILL.md).

### Dev tools

| Command                                                                                           | Purpose                               |
| ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `node apps/mobile/tools/gen-route.mjs --type run --km 5 > apps/mobile/tools/fixtures/run-5k.gpx`  | Synthetic GPS route                   |
| `node apps/mobile/tools/route-stats.mjs apps/mobile/tools/fixtures/run-5k.gpx`                    | Reference stats (the oracle)          |
| `apps/mobile/tools/sim-location.sh ios apps/mobile/tools/fixtures/run-5k.gpx`                     | Replay a route into the simulator     |
| `node apps/mobile/tools/gen-history.mjs --days 120 --out apps/mobile/tools/fixtures/history`      | Months of overlapping activities      |
| `node apps/mobile/tools/turf-preview.mjs apps/mobile/tools/fixtures/history --out /tmp/turf.html` | Turf look and parameter tuning        |
| `apps/mobile/tools/device-diagnose.sh`                                                            | Recording timeline from a phone       |
| `node apps/mobile/tools/turf-report.mjs <db>`                                                     | Per-activity turf counts              |
| `apps/mobile/tools/fetch-maplibre-ios.sh`                                                         | Vendor MapLibre for iOS (once)        |
| `node apps/mobile/tools/brand/render-assets.mjs`                                                  | Icon, splash, social and store images |
| `pnpm -C apps/mobile run android:build`                                                           | Android APK on EAS                    |

The diagnostics tools never print coordinates: location data is personal data.

### Environment

No `.env` is needed for local app development. The local `admin` and `demo` profiles work in every
build (decision B6 in `docs/plans/backend-plan-2026-10-22.md`); any other e-mail signs in with a
code against the API. On the API's local PGlite database the same two e-mails sign in to the web
portal with code `000000`, and `demo@` gets the Gdańsk demo history.

Sign-in and cloud backup talk to `API_BASE_URL` in `apps/mobile/src/constants/api.ts`:
`EXPO_PUBLIC_API_URL` when set, else the production API `https://city-turfer-api.vercel.app` (a
phone can override it in Info › Developer tools). The API reads its database URL and `API_TOKENS`
(hashes of device tokens) from the environment: see the
[API deploy runbook](./docs/operations/api-deploy.md).

---

## Quick start

Prerequisites: Node 22.15.1 (`nvm use`), pnpm (`corepack enable` picks the pinned version), Xcode
26.4+, an iOS Simulator or an iPhone.

```sh
nvm use
corepack enable                            # once: pnpm at the version in package.json "packageManager"
pnpm install --frozen-lockfile
apps/mobile/tools/fetch-maplibre-ios.sh    # once: Xcode's SPM download of MapLibre hangs on some machines
pnpm ios                                   # build and install a development build
pnpm start                                 # later: Metro for the installed build
```

Sign in with `admin@cityturfer.com` / `admin1234`, or with `demo@cityturfer.com` / `demo1234`, which
fills itself with Gdańsk demo data on first sign-in. To see turf around you, use **Me → Info → Seed
demo history** (90 days of activities around your location). In a release build the demo tools are
hidden: long-press the version text on Info five times to show them.

Website, Storybook and API:

```sh
pnpm run web:dev                             # https://cityturfer.local (Swagger at /swagger)
pnpm --filter @cityturfer/storybook dev      # http://localhost:6006
pnpm --filter @cityturfer/api dev            # http://localhost:8787
```

Local quirks: watchman is disabled in the Jest and Metro config (broken Homebrew install), and
`.npmrc` sets pnpm to a flat (`node-linker=hoisted`) `node_modules` with lenient peer dependencies.

---

## Testing

```sh
pnpm run ci:quality   # Prettier, ESLint, tsc, dependency rules, unit tests, builds, audits
pnpm test:chain       # phone → API → web portal sync chain on an in-memory PGlite (not in CI yet)
pnpm run audit:i18n   # English and Polish app copy in step (also part of ci:quality)
pnpm run test:e2e     # Maestro flows in apps/mobile/e2e/ on the booted iOS Simulator
```

Unit tests run on real SQL (`better-sqlite3`) and cover domain invariants, metrics against the
oracle (±3 %), the full context chain (including a crash between steps), idempotency, turf release
on delete, the turf strength vectors shared with `turf-preview.mjs`, Cloud backup against a fake
server, the API on PGlite (user isolation and server turf included) and WCAG contrast of the brand
colours. The sync chain checks that the phone, the API and the web portal agree (turf cell for cell,
totals). Maestro covers sign-in, recording (with pause/resume and in the background), history,
rename, the Turf Map, the Me menu, the Dashboard, Apple Health, the Home City, the turf toggle on
the Record map, account settings, the language setting and sign-out. Details:
[E2E](./docs/quality/e2e.md).

---

## Releases and OTA updates

Branches go `feat/<domain>` → `scope/vX.Y.Z` → `release/vX.Y.Z` → `main`, with PR titles
`city-turfer - <branch>`, merge commits and Conventional Commits. After CI is green on `main`, the
Release workflow tags `vX.Y.Z` and writes `CHANGELOG.md`. Full policy:
[Release manager](./docs/process/release-manager.md). Claude Code hooks deny the worst mistakes
(push to `main`, hand-made tags, wrong PR base).

```sh
pnpm -C apps/mobile dlx eas-cli@latest update --channel production --environment production --platform ios \
  --message "<what changed>" --non-interactive
```

OTA updates reach only builds with the same runtime fingerprint. Changing native code, plugins or
`app.json` (including its `version`) needs a new build: v0.10.0 is such a release (the Street Plate
typefaces, and the release commit bumps `app.json`'s `version`). Details:
[OTA release](./docs/operations/ota-release.md),
[Android release](./docs/operations/android-release.md).

---

## Documentation

| Document                                                  | For                                                  |
| --------------------------------------------------------- | ---------------------------------------------------- |
| [Product brief](./docs/product/product-brief.md)          | What the product is, who it's for, what's true today |
| [PoC plan](./docs/poc-plan.md)                            | Ubiquitous language, DDD, milestones                 |
| [Features](./docs/engineering/features.md)                | Every shipped feature by screen                      |
| [Decisions](./docs/decisions/)                            | API, sync, brand, Apple Health, monorepo, …          |
| [Docs index](./docs/INDEX.md)                             | Every doc with its status (generated)                |
| [Docs conventions](./docs/process/docs-conventions.md)    | Frontmatter, folders, filenames, the audit           |
| [Release manager](./docs/process/release-manager.md)      | Branch policy, versioning, CI                        |
| [Session logs](./docs/sessions/)                          | What was built and verified, per version             |
| [Plans](./docs/plans/)                                    | Live plans (backend, account settings, sync chain)   |
| [CLAUDE.md](./CLAUDE.md)                                  | Hard rules and commands for Claude Code              |
| [Brand system](./.claude/skills/brand-system/SKILL.md)    | Name, voice, colours, type, icons, store copy        |
| [Skills](./.claude/skills/) · [agents](./.claude/agents/) | How Claude Code works in this repo                   |

Version history: [`CHANGELOG.md`](./CHANGELOG.md), generated from Conventional Commit messages.

---

## License

Private and unlicensed. All rights reserved, Interdisciplinary sp. z o.o.
