---
status: proposed
verified: 2026-10-22
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
  account, export) — founder decisions of 2026-10-22, what feat/backend-sync built, and what is left
  before testers can use it
---

# Back-end plan: backup, accounts and restore

Planned on 2026-10-22 by a team of agents (api-engineer, rn-architect, product-manager,
mobile-reviewer, location-engineer, mobile-test-engineer) and built on `feat/backend-sync` →
`scope/v0.9.0`. It continues the one-way backup of v0.8.0 (`docs/sessions/v0.8.0.md`,
`docs/decisions/api-device-tokens-2026-10-20.md`). Contract: 0.4.0 in `apps/api/openapi.json`;
accounts: `docs/decisions/api-accounts-2026-10-22.md`.

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

## Left before testers

1. **Device checks** (never claimed from tests): sign in with a code on a real iPhone and Android
   phone, back up, delete the app, reinstall, restore — same activity count, distance, turf cells
   and Home City; the keychain after a reinstall offers the restore; a background recording makes no
   network call (mobile-testing layer 2); the Maestro suite with the email-first sign-in.
2. **Founder setup** (`docs/operations/api-deploy.md`): Brevo transactional mail with a verified
   sender (SPF, DKIM) and DPA; Vercel env `BETTER_AUTH_SECRET`, `BREVO_API_KEY`, `MAIL_FROM`,
   `API_PUBLIC_URL`; previews on their own Neon branch; `db:migrate` (0001–0003) before the deploy;
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

Two phones in step (`If-Match` corrections from both sides, `trackVersion`), server turf
(`/v1/turf/*` stay 501), background sync, Sign in with Apple — each a separate go from the founder.
