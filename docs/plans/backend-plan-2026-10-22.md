---
status: canonical
verified: 2026-10-23
owner: founder
scope:
  [
    apps/api,
    apps/mobile/src/contexts/cloud-backup,
    apps/mobile/src/contexts/identity,
    packages/core/src/contexts/identity,
    packages/core/src/contexts/activity-log,
    docs/decisions/api-accounts-2026-10-22.md,
    docs/decisions/api-sync-2026-10-20.md,
  ]
summary:
  Plan for the first back-end release (opt-in backup, real accounts, restore to a new phone, delete
  account, export) — founder decisions of 2026-10-22, what feat/backend-sync built (shipped in
  v0.9.0), what changed since, and what is left before testers can use it
---

# Back-end plan: backup, accounts and restore

Planned on 2026-10-22 by a team of agents (api-engineer, rn-architect, product-manager,
mobile-reviewer, location-engineer, mobile-test-engineer) and built on `feat/backend-sync` →
`scope/v0.9.0`. It continues the one-way backup of v0.8.0 (`docs/sessions/v0.8.0.md`,
`docs/decisions/api-device-tokens-2026-10-20.md`). Contract: 0.4.0 in `apps/api/openapi.json`;
accounts: `docs/decisions/api-accounts-2026-10-22.md`.

## Status (2026-10-23)

Built and shipped in v0.9.0 (#112, #121). Since then, in v0.10.0:

- **Passwords:** B3's "no passwords" was reversed by decision AC1
  (`docs/decisions/account-settings-2026-10-22.md`, #142): an optional account password beside the
  code, contract 0.5.0.
- **Server turf is built** (#149, contract 0.6.0): `/v1/turf/cells`, `/v1/turf/summary` and
  `/v1/activity-totals` answer instead of 501; migrations 0005 and 0006.
- **Web portal Slice 0** (#141): browser sign-in, what the server holds, export, delete, devices;
  migration 0004.
- Device tokens (`API_TOKENS`) are still accepted.

The "Left before testers" list below is still open. Whether the production setup ran (Neon
migrations, Vercel env, `auth:adopt`) is not visible in the repo: pending (founder).

## The job of this release

**"I don't lose my turf when I reinstall or change phones."** Nobody has asked for it yet
(assumption A10 in `docs/product/discovery-board.md`), so demand is tested while it ships (below).

## Founder decisions (2026-10-22)

| #   | Decision                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | Backup stays **opt-in, off by default**; using the app without an account stays a full mode, with no nag                                               |
| B2  | Release 1 = **real accounts + restore to a new phone + delete account + export + rename**. Two phones editing at once, server turf and social: later   |
| B3  | Sign-in by **e-mailed one-time code** (Better Auth `emailOTP`, mail via Brevo). No passwords, no native module. Sign in with Apple with a later build  |
| B4  | **Withdrawing a consent erases only the server copy**, never anything on a phone (no tombstones)                                                       |
| B5  | Apple Health: unchanged from v0.8.0 — `hk-*` uploads only behind its own opt-in; withdrawing it erases those copies; `source` now derived from the id  |
| B6  | The local `admin` and `demo` profiles keep working in every build; `demo` never talks to the API; `admin` history joins an account only after a prompt |

## What `feat/backend-sync` built

- **Server** (`apps/api`): sign-in by code (`/v1/auth/codes`, `/v1/auth/sign-in`, sign-out,
  `/v1/me`), our own rate limits in Postgres, device tokens still accepted for one release,
  `auth:adopt` for existing data; `PATCH` rename with `renamedAt` last-write-wins; the changes feed
  without previews and with a ~1 MB page cap (restore never hits Vercel's 4.5 MB cap); withdrawal
  erases the server copy and its exports; `DELETE /v1/me`; export as a zip (data + GPX) with an
  e-mailed link valid 24 h; validation errors capped at 20; `coreVersion` in health. Production
  refuses to boot without its secrets or with the fixed test code, which only works for
  `@e2e.cityturfer.test` addresses anyway.
- **Phone** (`apps/mobile`, `packages/core`): `ActivityRenamed`, a restore import (origin `restore`:
  never re-uploaded or exported to Apple Health, gap routes kept so the router is not asked again),
  `ChooseHomeCity` with `chosenAt`, the time zone kept per activity; backup now reconciles changes
  made while it was off and keeps state per account; email-code sign-in next to the local profiles,
  the account ↔ profile map, delete account and export; restore with progress, resumable after a
  kill, paused while recording; the background GPS task kept offline by a dependency rule and a
  headless test. Still OTA: iOS fingerprint `4b7cea7c…` as on the scope.
- **After the integration audit (2026-10-22):** the app points at the production API
  (`EXPO_PUBLIC_API_URL`, default `https://city-turfer-api.vercel.app`) instead of the old v0.8.0
  preview; rename on the activity screen; a restore is offered whenever the server holds activities
  the phone lacks (never ones deleted here), "Not now" is remembered and the backup card always has
  "Restore from backup"; after a restore the server's consents turn backup back on; the mock-auth
  start guard that crashed production builds is gone (B6). Server: production refuses to boot
  without `DATABASE_URL` or `CRON_SECRET`; unexpected errors log one sanitised line; a daily Vercel
  Cron purges expired exports, codes, sessions and rate-limit rows; `user:find` and `user:delete`
  answer support requests without an admin panel.

## Left before testers

1. **Device checks** (never claimed from tests): sign in with a code on a real iPhone and Android
   phone, back up, delete the app, reinstall, restore — same activity count, distance, turf cells
   and Home City; the keychain after a reinstall offers the restore; a background recording makes no
   network call (mobile-testing layer 2); the Maestro suite with the email-first sign-in.
2. **Founder setup** (`docs/operations/api-deploy.md`): Brevo transactional mail with a verified
   sender (SPF, DKIM) and DPA; Vercel env `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BREVO_API_KEY`,
   `MAIL_FROM`, `API_PUBLIC_URL`, `CRON_SECRET`; production branch `main`; previews on their own
   Neon branch; `db:migrate` (0001–0003 then; 0004–0006 since v0.10.0) before the deploy;
   `auth:adopt -- admin <email>`; then remove `API_TOKENS`. Vercel Pro before testers (Hobby is
   non-commercial).
3. **Deploy checks**: an export over 4.5 MB streams through Vercel; Better Auth cold start and
   bundle size; Neon WebSocket with large `bytea`.
4. **Launch items**: privacy policy and terms (PL/EN) naming accounts, backup and the processors
   (Vercel, Neon, Brevo); App Privacy label and Play Data safety; the brand line "Your routes stay
   on your phone." reworded for opt-in backup (brand-designer drafts, founder approves).
5. **Demand test**: a disclosed "Back up your turf" fake door on the website and a lost-phone
   interview probe. Bar: ≥ 3 of 5 interviewees raise losing a phone unprompted; ≥ 3 of 8 testers
   turn backup on within two weeks. If it fails, phase 2 waits.

## Later

Two phones in step (`If-Match` corrections from both sides, `trackVersion`), background sync, Sign
in with Apple — each a separate go from the founder. Server turf was planned here as later; it was
built in #149. The phone pulling changes and a web delete that reaches every phone are proposed in
`docs/decisions/data-flow-2026-10-23.md` (F1–F4, not built).
