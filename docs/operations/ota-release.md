---
status: canonical
verified: 2026-10-17
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
  runbook #7): anything that changes the fingerprint. Say so in the PR's "Risk & rollback".

To check, compare the fingerprint of the checkout you'll publish from with the runtime of the latest
update the phone already runs:

```bash
pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform ios
pnpm -C apps/mobile dlx eas-cli@latest channel:view production       # "Runtime Version" of the latest group
```

## Publish

1. On the branch being shipped, the gate is green: `pnpm run ci:quality` (and the simulator replay
   for recording changes).
2. Publish (iOS only today; Android has no build yet):

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
