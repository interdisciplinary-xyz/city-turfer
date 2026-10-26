---
status: canonical
verified: 2026-10-23
owner: founder
scope: [apps/mobile/app.json, apps/mobile/src/app/info.tsx, docs/process/release-manager.md]
summary:
  How to ship a JS-only change over the air on EAS channel production, check it landed, and when a
  reinstall is needed instead
---

# OTA release

How a JS-only change reaches the installed app without a reinstall. Branch policy and versioning:
`docs/process/release-manager.md`. When something goes wrong: `docs/operations/runbook.md` (#3 not
received, #4 bad update).

## How it's wired

- `app.json`: `runtimeVersion.policy: fingerprint`; `updates.url` points at the EAS project;
  `requestHeaders.expo-channel-name: production`; `checkAutomatically: ON_LOAD`,
  `fallbackToCacheTimeout: 0`.
- EAS channel `production` serves branch `production`
  (`pnpm -C apps/mobile dlx eas-cli@latest channel:view production`).
- On launch the app checks for an update and downloads it in the background; it applies on the
  **next** cold start. **Me → Info → Check for updates** fetches and reloads at once
  (`apps/mobile/src/app/info.tsx`).
- An update only reaches binaries with the same **runtime fingerprint**. The fingerprint covers
  native code and config: `apps/mobile/modules/`, `apps/mobile/plugins/`, native dependencies,
  permissions, icons, splash, and `app.json` (its `version` included).

## OTA or reinstall?

- **OTA:** changes only in `apps/mobile/src/` (TypeScript, screens, domain), JS-only dependencies,
  assets bundled by Metro.
- **Reinstall** (`pnpm -C apps/mobile exec expo run:ios --configuration Release --device <udid>`,
  runbook #7): anything that changes the fingerprint. Say so in the PR's "Risk & rollback". That
  includes any edit under `apps/mobile/plugins/` (config plugins are hashed even when the change is
  formatting, e.g. a lint autofix), `app.json`, native modules and native dependencies.
- **The release commit moves the fingerprint.** On `main`, `release.yml` bumps
  `apps/mobile/app.json` `version`, so a build made from `scope/…` or `release/…` before that commit
  gets no OTA published from `main` afterwards, even when the release was JS only (follow-up in
  `docs/sessions/v0.10.0.md`). Build the phone from the release tag, or publish from the commit it
  was built from.

v0.10.0 is a native release: the bundled typefaces (#140) and then the release commit's `app.json`
bump to 0.10.0 both moved the fingerprint. Before the bump (scope up to `549c873`): iOS
`1b3ffa48d51f84290c29865c26ae06359693d456`, Android `4dcf4be7518455cd70c3618da76c8b10998b0cb9`.
After it, measured on `scope/v0.11.0` at `20431a7` (tag `v0.10.0` plus package.json version pins):
iOS `06aca0e17e430961e1ccb2fd755db451c830efda`, Android `ab6e3dbbd0c2ab97a3bc6e8395b0b376a0bb4684`.

v0.11.0 is JS only, released 2026-10-24: the code before the release commit has the fingerprint
above. The release commit `34b3d17` bumps `app.json` to 0.11.0, so the tag `v0.11.0` has a new
fingerprint (not measured). Which installs take which OTA depends on the founder's choice in
`docs/process/release-manager.md` ("Pin at cut", v0.11.0).

v0.12.0 is JS only, released 2026-10-26: before its release commit the fingerprint was still the one
above (#181). The release commit `fc6fa57` bumps `app.json` to 0.12.0; at the tag `v0.12.0` iOS is
`ff7765f0f2943b53eaa6b537d7821d9599e485dd` (Android not measured). The founder's iPhone was
reinstalled from that tag on 2026-10-26 (runbook #7), so it takes OTAs published from `v0.12.0` or
from `scope/v0.13.0` while the fingerprint stays equal (equal at `1caf481`, measured 2026-10-26). No
OTA is recorded for v0.11.0 or v0.12.0 in the session logs.

To check, compare the fingerprint of the checkout you'll publish from with the runtime of the latest
update the phone already runs:

```bash
pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform ios
pnpm -C apps/mobile dlx eas-cli@latest channel:view production       # "Runtime Version" of the latest group
```

## Publish

1. On the branch being shipped, the gate is green: `pnpm run ci:quality` (and the simulator replay
   for recording changes).
2. Publish (iOS here; add `--platform android`, or `all`, for the sideloaded APK,
   `docs/operations/android-release.md`):

   ```bash
   pnpm -C apps/mobile dlx eas-cli@latest update --channel production --environment production --platform ios \
     --message "<what changed>" --non-interactive
   ```

   `--environment` is required for Expo SDK 55 and later (`eas update --help`).

3. Note the update group id and runtime version it prints.

## Check it landed

1. On the phone: kill and reopen the app twice, or tap **Me → Info → Check for updates**.
2. **Me → Info** shows `Update <first 8 characters of the id> · <date> · production`. It must match
   the published update.
3. Record it in the version's session log (in `docs/sessions/`): update id, runtime fingerprint,
   what it shipped. Example from v0.1.0: "OTA `01a144ce` published (runtime `271b7981…`, no
   reinstall)".

## Undo

`pnpm -C apps/mobile dlx eas-cli@latest update:rollback <GROUP_ID>` republishes the previous group
(runbook #4). A phone that crashes before it can check for updates needs a reinstall.
