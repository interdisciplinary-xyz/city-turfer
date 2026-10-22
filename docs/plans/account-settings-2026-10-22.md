---
status: canonical
verified: 2026-10-22
owner: founder
scope:
  [
    apps/api/src/identity,
    apps/api/src/routes/identity.ts,
    packages/core/src/contexts/identity,
    apps/mobile/src/app/account.tsx,
    apps/web,
  ]
summary:
  A complete Account tab on the phone and on the web portal — change name, e-mail and password —
  over one set of API routes and one set of rules in core; passwords as an optional second sign-in
  method beside e-mailed codes (reverses A1, needs a decision), step-up codes, security mails, tests
  at every layer
---

# Account tab: name, e-mail, password

**Goal:** a signed-in Turfer can see and change everything about their account in one place, on the
phone (Me › Account) and on the web portal (`/[locale]/account`), with the same rules, the same
words and the same server data on both.

Builds on `docs/decisions/api-accounts-2026-10-22.md` (codes, sessions, deletion) and the web and
admin portal plans (web-portal and portals-execution, dated 2026-10-22, on the main checkout; not
yet on this scope). Decisions: `docs/decisions/account-settings-2026-10-22.md`.

## Where we start (checked in code, 2026-10-22)

| Thing                | Today                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in              | E-mailed 6-digit code only. Passwords are **explicitly rejected** in decision A1; `emailAndPassword: { enabled: false }` in `apps/api/src/identity/better-auth.ts`                    |
| Library              | Better Auth 1.7.7. Its `emailOTP` plugin already supports change-e-mail by code (with `verifyCurrentEmail`) and password reset by code; core has `updateUser` and `changePassword`    |
| Name                 | `users.display_name` exists but nothing sets it; `/v1/me` falls back to the **user id** (`u_7Hq2…`), which the phone then shows as a name. `auth_users.name` is a second, unused copy |
| E-mail               | Stored twice: `auth_users.email` (unique, sign-in) and `users.email`                                                                                                                  |
| Password storage     | `auth_accounts.password` exists (Better Auth `credential` provider), unused. **No migration needed** for any of this plan                                                             |
| Phone Account screen | `apps/mobile/src/app/account.tsx`: read-only rows (Email, Sign-in, Data) + Sign out, Export, Delete                                                                                   |
| Phone local profiles | Local (no-account) profiles sign in with a **local password** (mock gateway). Not the same thing as an account password — the copy must keep them apart                               |
| Web portal           | `/account` pages are being built now (lane A); Privacy & data is read-only apart from export, delete, sign-out                                                                        |

## Decisions for the founder

| #   | Decision                           | Recommendation                                                                                                                                                                                               |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | Passwords at all? (reverses A1)    | **Optional password beside codes.** Codes stay the default and the recovery path; a Turfer may add a password for faster sign-in. New record `account-settings-<date>` supersedes A1's "passwords" rejection |
| AC2 | Password rules                     | NIST 800-63B: 12–128 characters, no composition rules, spaces allowed, checked against a breached-password list. Better Auth's scrypt hashing                                                                |
| AC3 | Breached-password check            | Have I Been Pwned range API (k-anonymity: only 5 hex characters of a SHA-1 leave the server). Fail open on timeout, never log the password or hash. Alternative: a bundled top-100k list (no third party)    |
| AC4 | Step-up for sensitive changes      | **A fresh code to the current address** for: change e-mail, set, change or remove password. One rule everywhere, works for code-only accounts                                                                |
| AC5 | After an e-mail or password change | Sign out **every other** session (phones and browsers); the device that made the change stays signed in. Security mail to the (old) address                                                                  |
| AC6 | Name                               | `users.display_name` is the one source; 1–40 characters after trim, NFC, no control characters; empty clears it. `/v1/me` returns `null` instead of the user id, UIs show "You"                              |
| AC7 | Staff (admin portal)               | Staff can **see** "has password" and the last change dates, never change name, e-mail or password for a user (takeover vector). Matches the admin plan's read-only stance                                    |
| AC8 | Order                              | Slice 1 (name + e-mail) does not depend on AC1, so it starts now; slice 2 (password) starts when AC1 is answered                                                                                             |

If AC1 is "no", slice 2 becomes: the Account tab shows "Sign-in: e-mailed code, no password needed"
and nothing else changes.

## Rules (in core, so phone, web and API agree)

New value objects in `packages/core/src/contexts/identity/domain/` (pure, unit-tested, used by the
API for validation and by both UIs for instant feedback):

- `DisplayName`: trims, NFC-normalises, rejects control characters and >40 characters; `''` → none.
- `Email`: the existing `email()` value object, lower-cased; "same as current" is an error.
- `PasswordPolicy`: length 12–128 (counted in code points), no composition rules; the breach check
  stays in the API (it needs the network).
- Error codes shared with the API's problem `code`s, so both UIs map one set of messages.

## API (contract 0.5.0)

All routes declared with `defineRoute` (the `api-design` skill), problem+json errors, signed-in
users only; device-token callers get `403 identity.account-required`. Rate limits reuse A5's
Postgres buckets.

| Route                              | Body → answer                                                                                     | Notes                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/me`                       | → `{ id, email, displayName \| null, hasPassword, passwordChangedAt, emailChangedAt, createdAt }` | `displayName` no longer falls back to the id                                                                                                                   |
| `PATCH /v1/me`                     | `{ displayName }` → `200 Me`                                                                      | Writes `users.display_name` and mirrors `auth_users.name` in the same transaction                                                                              |
| `POST /v1/me/step-up/codes`        | `{}` → `202 {}`                                                                                   | Mails a code to the **current** address, purpose `step-up`, 10 min; same limits as sign-in codes                                                               |
| `POST /v1/me/email/codes`          | `{ newEmail, stepUpCode }` → `202 {}`                                                             | Checks the step-up code, then mails a code to the **new** address. Always 202 for a valid code, even if the new address is taken (no enumeration)              |
| `POST /v1/me/email`                | `{ newEmail, code }` → `200 Me`                                                                   | One transaction: `auth_users.email`, `users.email`, `emailVerified`, pending codes cleared. Taken → `409 email.taken` (only shown after proving the new inbox) |
| `PUT /v1/me/password`              | `{ newPassword, stepUpCode }` → `204`                                                             | Sets or replaces; `422 password.too-short / too-long / breached`                                                                                               |
| `DELETE /v1/me/password`           | `{ stepUpCode }` → `204`                                                                          | Back to codes only                                                                                                                                             |
| `POST /v1/auth/sign-in` (extended) | `{ email, password }` as a second body shape → same `200`                                         | Wrong password or no password → `401 auth.invalid-credentials` (same answer for both); counts in the failed-sign-in buckets                                    |

- **Password reset needs no route of its own:** sign in with a code, then `PUT /v1/me/password`.
- Better Auth stays behind our routes (`auth.api.*`), never `auth.handler`. Turn on
  `emailAndPassword` with `disableSignUp: true` (accounts are still created only by a code).
- Steps AC4/AC5 inside one use case each in `apps/api/src/identity/use-cases.ts`; the security mails
  are new templates in `apps/api/src/identity/mailer.ts` (en/pl), sent after commit, a failure logs
  the event name only.
- **Never log** passwords, codes, addresses, or the hash prefix sent to the breach check.
- `DELETE /v1/me` already cascades `auth_accounts`, so passwords go with the account; a test pins
  it.

## Phone: Me › Account

`apps/mobile/src/app/account.tsx`, built from `@cityturfer/ui` pieces (`mobile-ui-engineer`).

```
Account
  Name ............ Ala     ›        (sheet: one field, Save)
  Email ........... m@…     ›        (screen: code to current → new address → code to new)
  Password ........ Not set ›        (Set / Change / Remove; each asks for a code first)
  Sign-in ......... Email code · password
  Data ............ Backed up (42 of 42)
  [Sign out]  [Export my data]  [Delete account]
```

- **Offline:** the editable rows show "Needs internet" and are disabled; nothing queues.
- **Local profile (no account):** Name is editable and stored on the phone only; Email and Password
  rows read "Create an account to back up and sign in anywhere".
- After an e-mail change the account-profile entry is updated (`AccountProfiles` keys by account id;
  the stored e-mail is refreshed so a later deleted-account lookup still matches).
- Sign-in screen: "Use a password instead" link under the e-mail field; code stays the default.
- `AuthGateway` / account port in core identity gets the new operations; `MockAuthGateway`
  implements them in memory for tests and the demo account.
- JS only (no new native module): ships as an OTA update. Check the fingerprint anyway.
- Profile header (`apps/mobile/src/app/profile.tsx`) shows the name or "You", never the id.

## Web portal: `/[locale]/account`

Owned by lane A (`portal-engineer`, the `web-portal` skill). A **Profile** section at the top of the
existing account page, the same three rows and flows as the phone, through the shared typed API
client (planned). Cookie sessions and the CSRF guard already cover the writes. This makes the portal
no longer "read-only apart from account actions" in spirit, but these _are_ account actions, so D5
holds; no activity or turf data becomes writable.

## Copy and mails (`brand-designer`)

- Keys in `packages/brand` vocabulary (shared) and `portal.account.*` in
  `apps/web/messages/en.json`, `pl.json`; the phone uses the same words.
- "Password" is always "account password" where a local profile could be confused.
- Three mails, en/pl, plain text first: e-mail changed (to the old address, with "not you? sign in
  and change it back"), password set or changed, password removed. No links that sign anyone in.

## Tests ("fully covered")

| Layer       | What                                                                                                                                                                              | Where / who                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Core        | `DisplayName`, `Email`, `PasswordPolicy` edge cases (unicode, spaces, 12/128 boundaries, control chars)                                                                           | `packages/core`, api-engineer                 |
| API         | Every route on PGlite: happy path, wrong/expired step-up code, taken address, no enumeration, both e-mail columns updated, other sessions revoked, rate limits, breach check fake | `apps/api/src/__tests__/`, api-engineer       |
| API privacy | Log audit finds no address, code or password; deletion removes the password row                                                                                                   | `tools/` log audit, mobile-reviewer           |
| Phone       | Account use cases with the mock gateway; offline states                                                                                                                           | Jest, mobile-test-engineer                    |
| Phone E2E   | New Maestro flow: rename, change e-mail between two `@e2e.cityturfer.test` addresses, set and use a password, remove it (`AUTH_FIXED_CODE`)                                       | `apps/mobile/e2e/`, mobile-test-engineer      |
| Web         | Stories for each state; Playwright for the same flows                                                                                                                             | apps/storybook, apps/web E2E, portal-engineer |
| Parity      | One fixture of names and passwords run through core, the API and both UIs' validation (gate like G1 in the admin plan)                                                            | harness-engineer                              |
| Review      | `mobile-reviewer`, plus the `data-privacy-reviewer` skill (new mails, third-party breach check)                                                                                   | before each PR                                |

## Work items

| #   | Item                                                                                                     | Owner                                                   | Needs   |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------- |
| 1   | Decision record `account-settings-<date>` (AC1–AC8)                                                      | product-manager, api-engineer                           | founder |
| 2   | Core value objects and error codes                                                                       | api-engineer (ddd-architecture)                         | —       |
| 3   | `PATCH /v1/me`, `/v1/me` without the id fallback, step-up codes                                          | api-engineer                                            | 2       |
| 4   | Change e-mail routes + security mail                                                                     | api-engineer, brand-designer                            | 3       |
| 5   | Phone: Name and Email rows, profile header fix                                                           | mobile-ui-engineer                                      | 3, 4    |
| 6   | Web: Profile section, name and e-mail                                                                    | portal-engineer (lane A)                                | 3, 4    |
| 7   | Password: Better Auth config, `PUT`/`DELETE /v1/me/password`, sign-in body, breach check                 | api-engineer                                            | 1 (AC1) |
| 8   | Phone and web password rows, "use a password" on sign-in                                                 | mobile-ui-engineer, portal-engineer                     | 7       |
| 9   | Maestro flow, Playwright, parity fixture                                                                 | mobile-test-engineer, portal-engineer, harness-engineer | 5, 6, 8 |
| 10  | Docs: update `api-accounts` record, `docs/engineering/features.md`, privacy policy (breach check, mails) | product-manager                                         | 7       |

**Slice 1 = items 2–6** (no password, no reversal of A1). **Slice 2 = items 7–8.** Item 9 runs with
each slice.

## Fitting the running sessions

- The API routes belong to lane D (`feat/api-portal-routes`) or a new `feat/account-settings` branch
  off `scope/v0.10.0`; declare them in the 0.5.0 contract first so lane A can code against the
  generated client.
- No migration, so the "one migration" hotspot is untouched.
- `apps/api/src/middleware.ts` is not changed; step-up is a use-case check, not a middleware.
- The web Profile section is a hand-off to the web-portal session, not built from here.

## Done means

1. On phone and web, a Turfer can rename, change e-mail and (if AC1 = yes) set, change, use and
   remove a password; each sensitive step asks for a fresh code.
2. The other device shows the new name and e-mail on its next `/v1/me`, and is signed out after an
   e-mail or password change.
3. The old address gets a mail after an e-mail change; nobody can learn whether an address has an
   account.
4. No password, code or address appears in any log; `ci:quality`, both E2E suites and the parity
   fixture pass.
