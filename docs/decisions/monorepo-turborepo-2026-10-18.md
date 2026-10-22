---
status: canonical
verified: 2026-10-18
owner: founder
scope: [package.json, .github/workflows, tools]
summary:
  v0.3.0 moves the repo to a pnpm + Turborepo monorepo — apps/mobile (Expo), apps/web (Next.js
  landing page), packages/brand and packages/config — in three PRs
---

# Monorepo with Turborepo (v0.3.0)

Decided 2026-10-18 in the v0.3.0 session (`docs/sessions/v0.3.0.md`). Code wins on conflict once the
PRs land.

## Decision

- **Turborepo** monorepo with two apps: the current Expo app and a new web landing page.
- **Landing page:** static showcase only. No waitlist, no forms, no analytics on visitors, so no
  backend and no personal data.
- **Web stack:** Next.js (App Router, static export) on Vercel.
- **Package manager:** pnpm, replacing npm 10 + `legacy-peer-deps`.
- **Shared from day one:** `packages/brand` and `packages/config`.
- **Migration:** three PRs into `scope/v0.3.0`, each verified before the next.

Rejected: one big PR (a broken native build couldn't be traced to pnpm, the move or hoisting); web
first, monorepo later (the setup work twice); Astro (a new tool for one page); Expo web (heavy
bundle, weak SEO); npm workspaces (chosen against in favour of pnpm).

## Layout

```
city-turfer/
├─ apps/
│  ├─ mobile/          the Expo app as today: src/, index.ts, app.json, ios/, modules/, plugins/,
│  │                   vendor/, assets/, e2e/, metro/jest/tsconfig, .dependency-cruiser.cjs
│  │  └─ tools/        mobile-only tools: gen-route, route-stats, sim-location, gen-history,
│  │                   turf-preview/report, diagnose-*, fetch-maplibre-ios, e2e/, lib/, fixtures/,
│  │                   brand/render-assets
│  └─ web/             Next.js landing page
├─ packages/
│  ├─ brand/           @cityturfer/brand: colour tokens (incl. turf strength ramp), mark and
│  │                   wordmark SVGs, name and tagline. Plain TS + SVG, no React.
│  └─ config/          @cityturfer/config: tsconfig bases, ESLint flat-config presets, Prettier
├─ tools/              repo-wide only: docs-audit, check-secret-files, audit-logs, release/
├─ docs/ .github/ .husky/ .claude/
├─ CLAUDE.md AGENTS.md NOTEBOOK.md README.md CHANGELOG.md
├─ package.json        private root: scripts, commitlint, husky, commit-and-tag-version
└─ pnpm-workspace.yaml turbo.json .npmrc
```

- **One version, one tag, one CHANGELOG.** The root `package.json` carries the version; the release
  bump also writes `apps/mobile/app.json`.
- **Parity fixtures move with mobile** (turf vectors, the `geo.mjs` oracle), next to the app code
  they pin.
- **Brand tokens move to `packages/brand`**; mobile imports them. Domain code still never imports
  them.

## Tooling

- **pnpm:** `node-linker=hoisted` first (flat `node_modules`, like npm today). Isolated installs are
  a later, separate PR. `strict-peer-dependencies=false`, `auto-install-peers=true`.
  `pnpm-lock.yaml` replaces `package-lock.json`; `packageManager` pins pnpm for CI and corepack.
- **Expo in `apps/mobile`:** `expo/metro-config` detects the monorepo; keep `useWatchman = false`.
  The root `index.ts` entry (background task first) moves unchanged. `eas update` runs from
  `apps/mobile`; the OTA guide and runbook get the new path.
- **Turborepo tasks:** `typecheck`, `lint`, `test`, `arch` (mobile only), `build` (web only; native
  builds stay manual). Remote caching off at first.
- **Root `ci:quality`:** Prettier over the repo + `turbo run lint typecheck arch test` + repo tool
  checks (`audit:logs`, `e2e:audit`, secret guard).
- **CI:** `pnpm/action-setup` + pnpm store cache; job names unchanged so branch protection holds.
- **Hooks:** husky, commitlint, lint-staged at the root; `pre-push` runs
  `turbo run typecheck arch test --affected`.
- **Release workflow:** `pnpm install --frozen-lockfile`; `.versionrc.json` bumps the root
  `package.json` and `apps/mobile/app.json`.
- **Agent setup:** `.claude/` skills, agents and `CLAUDE.md` get the new paths and commands.

## Web app

- **Sections:** hero (mark, wordmark, "Surf your city. Own your streets."); how turf works (record a
  walk, run or ride → the streets become your turf → turf glows brighter with every repeat);
  screenshots of the Turf Map and Dashboard; privacy (local-first, your location stays on your
  phone); "coming soon" footer.
- **Look:** dark, matching the Turf Map; colours and SVGs from `@cityturfer/brand`; copy follows the
  `brand-system` skill. _Superseded in v0.10.0:_ the site is light (`SITE_SCHEME`) with maps on
  night panels: `docs/decisions/brand-light-theme-2026-10-22.md`.
- **Build:** `output: 'export'`, no server code, no cookies, no third-party scripts. _Narrowed in
  v0.10.0:_ public pages keep this; the signed-in portal under `/[locale]/account` uses one strictly
  necessary session cookie through the `/api/v1` route: `docs/decisions/web-portal-2026-10-22.md`.
- **Hosting:** a Vercel project with root directory `apps/web` and preview deployments per PR.
  Domain is open.

## PRs

1. `chore/pnpm-turborepo`: pnpm + `turbo.json` with the app still at the root. Done when: clean
   install, `ci:quality` green locally and in CI, a fresh iOS dev build runs, Maestro passes.
2. `chore/apps-mobile`: move the app to `apps/mobile`, split `tools/`, update CI, hooks, docs and
   `.claude/` paths. Done when: the same checks as PR 1, plus `eas update --dry-run` from
   `apps/mobile`, a Release build reinstalled over the app on the device (data kept), and `app.json`
   pinned to 0.3.0.
3. `feat/web-landing`: `packages/brand`, `packages/config`, `apps/web`, Vercel project. Done when:
   `turbo run build` green, mobile still renders the same colours, a Vercel preview URL works, and
   the page passes a Lighthouse check (performance and accessibility).

## Outcome

- [1/3] #48, [2/3] #49 and [3/3] #50 merged on 2026-10-18. Follow-ups: #51 (hero screenshots,
  portless), #52 (`@interdisciplinary/eslint-config` from empatalk replaces the ESLint presets in
  `packages/config`), `feat/dev-toolbar` (`@interdisciplinary/dev-toolbar`).
- `auto-install-peers=false` is required: with `true`, pnpm installed peers npm never did and
  CocoaPods autolinked them (Reanimated, Worklets, Gesture Handler).
- `react-dom` in the workspace makes Expo add `web` to the app's platforms; `app.json` pins
  `platforms: ios, android`. `apps/mobile/fingerprint.config.js` keeps `package.json` scripts out of
  the runtime fingerprint.

## Risks

- **Runtime fingerprint changes from PR 1 on** (hoisted autolinking paths and `package.json` scripts
  in PR 1; the move in PR 2): OTA stops reaching the installed build until the device gets the new
  Release build after PR 2. Publish no OTA in between. Reinstall over the app, don't delete it
  (runbook).
- **pnpm with native modules:** MapLibre local SPM (`apps/mobile/plugins/with-local-maplibre`), the
  local `apps/mobile/modules/background-session` module and autolinking need a fresh dev build to
  prove.
- **Background tracking:** must be re-checked on a device after PR 2; tests passing is not enough.
- **Rollback:** each PR reverts on its own on `scope/v0.3.0`.
