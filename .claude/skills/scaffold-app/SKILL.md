---
name: scaffold-app
description:
  Bootstrap the CityTurfer Expo/React Native project from an empty directory (milestone M1) —
  create-expo-app, install the GPS/map/storage stack, mock sign-in, configure app.config.ts
  permissions and background location, folder layout, Jest, and a first dev build. Use when the
  project has no package.json yet, or when the user says "set up the project", "init the app",
  "scaffold", or asks to add one of the core stack libraries.
---

# Scaffold the CityTurfer app

Goal: a dev build that launches on iOS + Android, with the stack from `CLAUDE.md` installed and
configured, an empty but typed folder skeleton, and passing `tsc` + `jest`. Do not build features
here — that's `add-feature`.

## 1. Create the project

The repo root already contains `CLAUDE.md`, `.claude/` and `tools/`. Create the app in place:

```bash
pnpm dlx create-expo-app@latest . --template default   # if it refuses a non-empty dir: create in a temp dir, then move files in (keep CLAUDE.md, .claude/, tools/)
git init   # if not already a repo
```

Remove the template's demo screens/components once the new skeleton (step 4) is in.

## 2. Install the stack

Always use `pnpm -C apps/mobile exec expo install` for anything native so versions match the SDK:

```bash
pnpm -C apps/mobile exec expo install expo-location expo-task-manager expo-sqlite expo-file-system expo-sharing \
  expo-dev-client expo-keep-awake expo-haptics expo-sensors @maplibre/maplibre-react-native
pnpm -C apps/mobile exec expo install expo-secure-store
pnpm add zustand h3-js
pnpm add -D jest-expo jest @testing-library/react-native @types/jest
```

## 3. app.config.ts

Convert `app.json` to `app.config.ts`. Required pieces:

```ts
plugins: [
  'expo-router',
  'expo-sqlite',
  '@maplibre/maplibre-react-native',
  ['expo-location', {
    locationAlwaysAndWhenInUsePermission:
      'CityTurfer records your route while you walk, run or ride, including when the screen is off.',
    locationWhenInUsePermission: 'CityTurfer shows your position and records your route.',
    isIosBackgroundLocationEnabled: true,
    isAndroidBackgroundLocationEnabled: true,
    isAndroidForegroundServiceEnabled: true,
  }],
],
ios: {
  bundleIdentifier: 'com.turftrack.app',
  infoPlist: { UIBackgroundModes: ['location'] },
},
android: {
  package: 'com.turftrack.app',
  permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'ACCESS_BACKGROUND_LOCATION',
    'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION'],
},
```

Maps use MapLibre with OpenFreeMap tiles (`https://tiles.openfreemap.org/styles/liberty` and a dark
variant), so no API key is needed. Check the current MapLibre RN Expo setup on its docs before
configuring; M0 includes a spike for it (`docs/poc-plan.md` §6).

## 4. Skeleton

Create the DDD layout from `docs/poc-plan.md` §5 and `CLAUDE.md`, following the `ddd-architecture`
skill: `apps/mobile/src/shared-kernel/`,
`apps/mobile/src/contexts/{identity,recording,activity-log,territory}/{domain,application,infrastructure,ui}/`
with `index.ts` public APIs, `apps/mobile/src/platform/` (db, migrations, outbox, EventDispatcher),
`apps/mobile/src/composition-root.ts`, and `apps/mobile/src/app/` screens (the root `index.ts` entry
imports `./src/contexts/recording/infrastructure/background-task` first). Stubs only — typed
signatures, no feature logic.

Install `pnpm add -D dependency-cruiser` and add the rules from the `ddd-architecture` skill; wire
`"test": "depcruise src --config .dependency-cruiser.cjs && jest"`.

## 4b. Mock sign-in (M1)

- No Firebase or any other auth SDK in the PoC (decision in `docs/poc-plan.md` §9).
- Implement `MockAuthGateway` in `apps/mobile/src/contexts/identity/infrastructure/`. It accepts
  only `admin@cityturfer.com` / `admin1234` (case-insensitive email, trimmed) and returns
  `UserId("admin")`. Everything else returns `AuthError('invalid-credentials')`. The credentials
  appear in this one file and its test, nowhere else.
- The composition root always wires it for the local profiles (decision B6 in
  `docs/plans/backend-plan-2026-10-22.md`); real accounts sign in by e-mailed code through
  `ApiAuthGateway`. There is no mock-mode switch or production start guard any more.
- On sign-in: store the uid in `expo-secure-store` and open `turftrack-<uid>.db`. On sign-out:
  refuse while a recording is active, then clear the stored uid and close the DB.
- The sign-in screen has `testID`s `sign-in-email`, `sign-in-password`, `sign-in-submit`,
  `sign-in-error`.

## 5. Tooling

- `tsconfig.json`: `"strict": true`, path alias `@/*` → `apps/mobile/src/*`.
- `package.json` scripts: `"typecheck": "tsc --noEmit"`, `"test": "jest"`, `"ios": "expo run:ios"`,
  `"android": "expo run:android"`.
- Jest preset `jest-expo`; add `jest.setup.ts` that mocks `expo-location`, `expo-task-manager` and
  `expo-sqlite` (see the `mobile-testing` skill).
- `.gitignore`: add `.env`, `ios/`, `android/`, `apps/mobile/tools/fixtures/history/` (CNG — native
  dirs are generated by prebuild).

## 6. Verify

```bash
pnpm -C apps/mobile exec tsc --noEmit && pnpm -C apps/mobile exec jest --passWithNoTests
pnpm -C apps/mobile exec expo run:ios      # or run:android — first native build takes several minutes
```

Report which platform you actually launched, and say so plainly if you could not run a native build
(for example, no Xcode or Android SDK on this machine).
