# CityTurfer

[![CI](https://github.com/interdisciplinary-xyz/city-turfer/actions/workflows/ci.yml/badge.svg)](https://github.com/interdisciplinary-xyz/city-turfer/actions/workflows/ci.yml)

<p align="center">
  <img src="packages/brand/svg/mark.svg" alt="CityTurfer" width="160">
</p>

**Surf your city. Own your streets.** A mobile app that records walks, runs and rides on a real map
and turns every street you cover into your **turf**: a corridor of map cells that stays yours and
glows brighter each time you come back.

**First feature: Turf.** Record an activity and the streets you covered become permanent cells on an
H3 hexagon grid (~50 m). Every visit makes a cell stronger. The Turf map shows it all: your tracks,
your turf, and how strong each part is. Stats, history and achievements build on that. See the
[PoC plan](./docs/poc-plan.md) for how the product grows from it.

> [!NOTE] Status: **v0.1.0 released** (iOS proof of concept), **v0.2.0 in progress**. Single demo
> account (`admin@cityturfer.com` / `admin1234`); all data stays on the device.

---

## Table of content

1. [Stack](#stack)
2. [Architecture](#architecture)
   - [Bounded contexts](#bounded-contexts)
   - [Screens](#screens)
   - [Scripts](#scripts)
   - [Dev tools](#dev-tools)
   - [Environment](#environment)
3. [Quick start](#quick-start)
4. [Testing](#testing)
5. [Releases & OTA updates](#releases--ota-updates)
6. [Documentation](#documentation)
7. [License](#license)

---

## Stack

| App                                    | Tests                | Tools                                    |
| -------------------------------------- | -------------------- | ---------------------------------------- |
| [Expo SDK 57][expo-sdk-57]             | [Jest][jest]         | [Husky][husky]                           |
| [React Native 0.86][react-native-0-86] | [Maestro][maestro]   | [Commitlint][commitlint]                 |
| [TypeScript][typescript]               | Simulator GPS replay | [Lint-staged][lint-staged]               |
| [expo-router][expo-router]             | Route-stats oracle   | [ESLint][eslint]                         |
| [expo-location][expo-location]         |                      | [Prettier][prettier]                     |
| [MapLibre][maplibre]                   |                      | [dependency-cruiser][dependency-cruiser] |
| [OpenFreeMap][openfreemap]             |                      | [EAS Update][eas-update]                 |
| [H3][h3]                               |                      |                                          |
| [expo-sqlite][expo-sqlite]             |                      |                                          |

[expo-sdk-57]: https://docs.expo.dev/
[jest]: https://jestjs.io/
[husky]: https://typicode.github.io/husky/
[react-native-0-86]: https://reactnative.dev/
[maestro]: https://maestro.dev/
[commitlint]: https://commitlint.js.org/
[typescript]: https://www.typescriptlang.org/
[lint-staged]: https://github.com/lint-staged/lint-staged
[expo-router]: https://docs.expo.dev/router/introduction/
[eslint]: https://eslint.org/
[expo-location]: https://docs.expo.dev/versions/latest/sdk/location/
[prettier]: https://prettier.io/
[maplibre]: https://maplibre.org/
[dependency-cruiser]: https://github.com/sverweij/dependency-cruiser
[openfreemap]: https://openfreemap.org/
[eas-update]: https://docs.expo.dev/eas-update/introduction/
[h3]: https://h3geo.org/
[expo-sqlite]: https://docs.expo.dev/versions/latest/sdk/sqlite/

Runtime: **Node 22.15.1** (`.nvmrc`), Xcode 26.4+ for iOS. Development builds only (Expo Go can't do
background location). JS changes ship over the air on EAS channel `production`; native changes need
a new build.

---

## Architecture

The repo is a pnpm + Turborepo monorepo
([decision](./docs/decisions/monorepo-turborepo-2026-10-18.md)):

| Path                      | What                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/`            | The Expo app (`@cityturfer/mobile`): app code, native module, plugins, Maestro, mobile dev tools                       |
| `apps/web/`               | Landing page (`@cityturfer/web`): Next.js static export on Vercel, English + Polish (`next-intl`)                      |
| `packages/brand/`         | `@cityturfer/brand`: colour tokens, name and copy, logo SVGs                                                           |
| `packages/config/`        | `@cityturfer/config`: Prettier and tsconfig bases                                                                      |
| `packages/eslint-config/` | `@interdisciplinary/eslint-config`: ESLint presets and local rules, shared with empatalk                               |
| `packages/dev-toolbar/`   | `@interdisciplinary/dev-toolbar`: dev-only toolbar for the landing page (request log, route map), shared with empatalk |
| `tools/`                  | Repo-wide tools: docs audit, log audit, secret-file guard, release helpers                                             |
| `docs/`                   | Documentation, indexed in `docs/INDEX.md`                                                                              |

Domain-Driven Design is a hard requirement. Each bounded context under `apps/mobile/src/contexts/*`
has `domain/`, `application/`, `infrastructure/` and `ui/` layers and a public `index.ts`. Contexts
talk only through each other's `index.ts` and published domain events. Aggregate changes and their
events are saved in one SQLite transaction (outbox), and event handlers are idempotent.
`pnpm run test:arch` (dependency-cruiser) enforces the rules: domain code imports no React, Expo or
infrastructure, and no context reaches into another's layers. Full design:
[PoC plan](./docs/poc-plan.md); rules:
[`ddd-architecture` skill](./.claude/skills/ddd-architecture/SKILL.md).

### Bounded contexts

| Context                                 | Purpose                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/mobile/src/contexts/identity`     | `AuthGateway` port; mock sign-in for the PoC; one SQLite DB per user           |
| `apps/mobile/src/contexts/recording`    | **Core.** Recording Session, Fix Filter, auto-pause, background task, recovery |
| `apps/mobile/src/contexts/activity-log` | Activities, history, detail, splits, demo import, street-routed gap estimates  |
| `apps/mobile/src/contexts/territory`    | **Core.** Claims, turf cells (H3 res 11), strength, Turf map                   |
| `apps/mobile/src/contexts/achievements` | Pure evaluation of achievements over activity and turf facts                   |

Shared code outside the contexts:

| Path                               | Purpose                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `apps/mobile/src/shared-kernel`    | Pure value objects and maths in SI units (distance, splits, elevation, simplify) |
| `apps/mobile/src/constants`        | Shared constants (activity types, colours, map styles); imports nothing          |
| `apps/mobile/src/platform`         | SQLite, migrations, outbox and event dispatcher, one-off jobs, diagnostics       |
| `apps/mobile/src/ui-kit`           | Theme hook, formatting, shared components, app context, Me menu                  |
| `apps/mobile/src/composition-root` | Lazy, React-free wiring used by the UI and the headless background task          |
| `apps/mobile/modules/`             | Native module `background-session` (iOS `CLBackgroundActivitySession`)           |

The background location task is defined at module top level in
`apps/mobile/src/contexts/recording/infrastructure/background-task.ts` and imported first by
`index.ts`. It translates fixes through the anti-corruption layer and calls the `IngestFixes` use
case; it never relies on React state.

---

### Screens

expo-router, file-based under `apps/mobile/src/app/`. Screens are thin: they compose context `ui/`
components and hooks.

| Route                      | Screen                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `(tabs)/index`             | Dashboard (start tab): greeting, this week, recent, achievements |
| `(tabs)/turf`              | Turf map: tracks, glowing turf, walk/run/ride filter             |
| `(tabs)/record`            | Record (raised centre tab): type picker, live map and stats      |
| `(tabs)/stats`             | This week, 8-week chart, turf totals, all-time per type          |
| `(tabs)/me`                | Opens the Me drawer: Profile, Account, Info                      |
| `history`                  | Activity history (from Dashboard and Stats)                      |
| `activity/[id]`            | Activity detail: map, stats, splits, turf gained, delete         |
| `profile` · `achievements` | Profile with totals; achievements with progress                  |
| `account` · `info`         | Sign out; app version, updates, data note, demo data             |
| `sign-in`                  | Mock sign-in                                                     |

---

### Scripts

Everyday commands from the root `package.json` (they run the app's scripts through Turborepo or
`pnpm --filter`); `pnpm run` is authoritative.

| Name                        | Description                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `start`                     | Metro for an installed development build                                                |
| `ios` / `android`           | Build and install a development build                                                   |
| `test:types` / `typecheck`  | `tsc --noEmit` in every workspace                                                       |
| `test:arch`                 | DDD dependency rules (dependency-cruiser)                                               |
| `test:unit`                 | Jest + node tool tests                                                                  |
| `test`                      | `arch` + Jest + tool tests                                                              |
| `test:e2e`                  | Maestro suite on the booted iOS Simulator (`apps/mobile/e2e/run.sh`)                    |
| `build`                     | Web static export (`apps/web/out`)                                                      |
| `web:dev`                   | Landing page at `https://cityturfer.local` (portless + dev server with the dev toolbar) |
| `standard` / `standard:fix` | Prettier + ESLint, check or apply                                                       |
| `ci:quality`                | Full local gate: `standard`, `test:types`, `test:arch`, `test:unit`                     |
| `audit:docs`                | Docs audit: dead paths, broken links, frontmatter, probes                               |
| `release`                   | `commit-and-tag-version` (run by CI on `main`, never by hand)                           |

> [!NOTE] **Tests passing doesn't prove background tracking works.** It needs a development build on
> a device, or a simulator with replayed movement (`apps/mobile/tools/sim-location.sh`). See the
> [`mobile-testing` skill](./.claude/skills/mobile-testing/SKILL.md).

---

### Dev tools

| Command                                                                                           | Purpose                           |
| ------------------------------------------------------------------------------------------------- | --------------------------------- |
| `node apps/mobile/tools/gen-route.mjs --type run --km 5 > apps/mobile/tools/fixtures/run-5k.gpx`  | Synthetic GPS route               |
| `node apps/mobile/tools/route-stats.mjs apps/mobile/tools/fixtures/run-5k.gpx`                    | Reference stats (the oracle)      |
| `apps/mobile/tools/sim-location.sh ios apps/mobile/tools/fixtures/run-5k.gpx`                     | Replay a route into the simulator |
| `node apps/mobile/tools/gen-history.mjs --days 120 --out apps/mobile/tools/fixtures/history`      | Months of overlapping activities  |
| `node apps/mobile/tools/turf-preview.mjs apps/mobile/tools/fixtures/history --out /tmp/turf.html` | Turf look and parameter tuning    |
| `apps/mobile/tools/device-diagnose.sh`                                                            | Recording timeline from a phone   |
| `node apps/mobile/tools/turf-report.mjs <db>`                                                     | Per-activity turf counts          |
| `apps/mobile/tools/fetch-maplibre-ios.sh`                                                         | Vendor MapLibre for iOS (once)    |
| `node apps/mobile/tools/brand/render-assets.mjs`                                                  | Icon and splash PNGs from SVG     |

The diagnostics tools never print coordinates: location data is personal data.

---

### Environment

No `.env` is needed for local development. Two public variables select the build mode
(`apps/mobile/src/composition-root.ts`):

- `EXPO_PUBLIC_AUTH_MODE`: default `mock` (the demo account)
- `EXPO_PUBLIC_APP_ENV`: default `poc`; the app refuses to start with mock auth when this is
  `production`

---

## Quick start

Prerequisites: Node 22.15.1 (`nvm use`), pnpm (`corepack enable` picks the pinned version), Xcode
26.4+, an iOS Simulator or an iPhone.

```sh
nvm use
corepack enable               # once: pnpm at the version in package.json "packageManager"
pnpm install --frozen-lockfile
apps/mobile/tools/fetch-maplibre-ios.sh   # once: Xcode's SPM download of MapLibre hangs on some machines
pnpm -C apps/mobile exec expo run:ios        # build and install a development build
pnpm start                    # later: Metro for the installed build
```

Sign in with `admin@cityturfer.com` / `admin1234`. To see turf straight away, use **Me → Info → Seed
demo history** (90 days of activities around your location). In a release build the demo tools are
hidden: long-press the version text on Info five times to show them.

Local quirks: watchman is disabled in the Jest and Metro config (broken Homebrew install), and
`.npmrc` sets pnpm to a flat (`node-linker=hoisted`) `node_modules` with lenient peer dependencies.

---

## Testing

```sh
pnpm run ci:quality   # Prettier, ESLint, tsc, dependency rules, Jest
pnpm run test:e2e     # Maestro flows in apps/mobile/e2e/ on the booted iOS Simulator
```

Unit tests cover domain invariants, metrics against the oracle (±3 %), the full context chain
(including a crash between steps), idempotency and turf release on delete. Maestro covers sign-in,
recording (with pause/resume and in the background), history, the Turf map, the Me menu and
sign-out.

---

## Releases & OTA updates

Branches go `feat/<domain>` → `scope/vX.Y.Z` → `release/vX.Y.Z` → `main`, with PR titles
`city-turfer - <branch>`, merge commits and Conventional Commits. After CI is green on `main`, the
Release workflow tags `vX.Y.Z` and writes `CHANGELOG.md`. Full policy:
[Release manager](./docs/process/release-manager.md).

```sh
pnpm -C apps/mobile dlx eas-cli@latest update --channel production --environment production --platform ios \
  --message "<what changed>" --non-interactive
```

OTA updates reach only builds with the same runtime fingerprint. Changing native code, plugins or
`app.json` (including its `version`) needs a new build.

---

## Documentation

| Document                                                  | For                                           |
| --------------------------------------------------------- | --------------------------------------------- |
| [PoC plan](./docs/poc-plan.md)                            | Product, ubiquitous language, DDD, milestones |
| [Docs index](./docs/INDEX.md)                             | Every doc with its status (generated)         |
| [Docs conventions](./docs/process/docs-conventions.md)    | Frontmatter, folders, filenames, the audit    |
| [Release manager](./docs/process/release-manager.md)      | Branch policy, versioning, CI                 |
| [Session logs](./docs/sessions/)                          | What was built and verified, per version      |
| [CLAUDE.md](./CLAUDE.md)                                  | Hard rules and commands for Claude Code       |
| [Brand system](./.claude/skills/brand-system/SKILL.md)    | Name, voice, colours, icons, store copy       |
| [Skills](./.claude/skills/) · [agents](./.claude/agents/) | How Claude Code works in this repo            |

Version history: [`CHANGELOG.md`](./CHANGELOG.md), generated from Conventional Commit messages.

---

## License

Private and unlicensed. All rights reserved, Interdisciplinary sp. z o.o.
