---
status: canonical
verified: 2026-10-19
owner: founder
scope: [packages/brand, packages/ui, apps/storybook, apps/mobile/src/ui-kit, apps/web/src/app]
summary:
  v0.5.0 design system — tokens in @cityturfer/brand (TS + CSS variables), React Native components
  in @cityturfer/ui, one Storybook (react-native-web) for the app and the website, shipped OTA
---

# Design system (v0.5.0)

Decided 2026-10-19 in the v0.5.0 session (`docs/sessions/v0.5.0.md`). How to work with it: the
`design-system` skill. Code wins on conflict.

## Decision

- **Tokens** live in `@cityturfer/brand` (`packages/brand/src/tokens.ts`) next to the colours:
  `SPACE`, `RADIUS`, `FONT_SIZE`, `FONT_WEIGHT`, `LABEL_TRACKING`, `TIER_ORDER`, `THEMES`. Values
  are the ones the v0.4.0 screens already used, so adopting a token changes no pixel.
- **Web gets CSS variables from a function**, `cssVariables(scheme)`, which `[locale]/layout.tsx`
  sets on `<html>` (always `'dark'`). Brand colours keep their brand names (`--glow`, `--strong`,
  `--walk`…), theme colours are semantic (`--bg`, `--card`, `--text`…), scales are `--space-*`,
  `--radius-*`, `--font-*`.
- **Components** live in `@cityturfer/ui` (`packages/ui`): React Native only, TS source, peer
  dependencies only. First set: `Button`, `Card`, `Stat`, `Badge` (+ `tint()`), `ActivityRow`,
  `TurfLegend`, plus `ThemeProvider` / `usePalette` / `useScheme`. Components are presentational:
  formatting and domain types stay in the contexts (the Activity Log maps its item to the row).
- **The app keeps its import paths**: `apps/mobile/src/ui-kit/components.tsx` and `theme.ts`
  re-export from `@cityturfer/ui`.
- **One Storybook** in `apps/storybook` (Storybook 10, `@storybook/react-native-web-vite`). It
  renders `@cityturfer/ui` through react-native-web and the website's components straight from
  `apps/web/src`, with toolbar toggles for light/dark and en/pl. Port 6006.
- **Native modules get placeholders** in Storybook (MapLibre Turf Map, GPS recording, HealthKit):
  they never run in a browser.
- **Deploy:** Storybook's static build on Vercel as a separate project (created only when the
  founder says so).

## Why this shape

- **Ship over the air.** Nothing here may change the runtime fingerprint. `@cityturfer/ui` has no
  native code and only peer dependencies; Expo autolinking resolves from the app's dependency tree,
  so Storybook, Vite and react-native-web (dependencies of `apps/storybook` only) never get linked.
  Checked after every step: iOS `2932ab55…`, Android `b5a00190…`, same as `scope/v0.4.0`.
- **A function instead of a generated file** for the CSS variables: nothing to regenerate, nothing
  to drift, and Storybook calls the same function.
- **No `app.json` version bump.** The release rule "pin at cut" would set `expo.version` to 0.5.0,
  but that field is part of the fingerprint (bumping it moved iOS to `9e3ebf89…`). `package.json`
  files carry 0.5.0; `app.json` follows with the next native reinstall, as in v0.4.0.
- **The website stays dark.** Storybook's light/dark toggle changes the app components only.
- **Storybook in `apps/`, not `packages/`:** it is deployed, like the web app.

Rejected: Storybook React Native on device (needs the simulator and a native build; we want a web
link anyone can open); a committed `tokens.css` (needs a drift check); moving MapLibre or HealthKit
components into `@cityturfer/ui` (would make the package native); adding `TurfLegend` to the Turf
Map in this release (a visible change, to decide separately).

## Consequences

- The website's markup did not change (verified byte-identical for `/en` and `/pl`); the hero was
  split into synchronous components (`hero-copy`, `hero-screens`, `store-buttons`) so Storybook can
  render them, and `LanguageSwitcher` uses `useTranslations`.
- **One react-native in the workspace.** `@react-native/jest-preset` is `~0.86.3` in both
  `apps/mobile` and `packages/ui`, matching `react-native` 0.86. A first version pinned 0.86 only in
  `packages/ui` while mobile had `^0.87.1`; pnpm then installed a second react-native in
  `packages/ui/node_modules` (found in review). `tools/__tests__/single-react-native.test.mjs` fails
  if any workspace gets its own `react-native` or `react` again.
- dependency-cruiser forbids `@cityturfer/ui` in `domain/`, `shared-kernel/` and `application/`.
- `ci:quality` builds Storybook (`turbo run build` includes `apps/storybook`).

## Open risk: the release commit changes the fingerprint

`.versionrc.json` bumps `apps/mobile/app.json` `expo.version` (through
`tools/release/app-json-version-updater.cjs`) when `release.yml` runs on `main`. That field is part
of the runtime fingerprint, so the release commit itself makes OTA updates stop matching installed
builds, whatever the release contains. v0.5.0 doesn't change this (the founder decides); options:
drop `app.json` from `bumpFiles` and bump it only with a native reinstall, or pin `runtimeVersion`
by hand instead of the `fingerprint` policy.
