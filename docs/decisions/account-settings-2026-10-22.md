---
status: canonical
verified: 2026-10-22
owner: founder
scope:
  [
    apps/api/src/identity,
    apps/api/src/routes/identity.ts,
    apps/api/src/schemas/identity.ts,
    packages/core/src/contexts/identity,
    apps/mobile/src/app/account.tsx,
  ]
summary:
  Account settings (contract 0.5.0) — change name, e-mail and an optional password; codes stay the
  default sign-in and the recovery path; a fresh code to the current address before any sensitive
  change; other sessions signed out and a security mail after an e-mail or password change
---

# Account settings: name, e-mail, optional password (contract 0.5.0)

On 2026-10-22 the founder asked to build the Account tab of
`docs/plans/account-settings-2026-10-22.md` with its recommendations. This record takes those
recommendations as decisions. It **narrows A1** of `docs/decisions/api-accounts-2026-10-22.md`:
e-mailed codes stay the default sign-in, and a Turfer may now _add_ a password.

## Decisions

| #   | Decision                      | Chosen                                                                                                                                                                                    | Rejected                                              |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| AC1 | Passwords                     | Optional, beside codes. Accounts are still created only by a code (`emailAndPassword.disableSignUp`). A forgotten password is "sign in with a code, then set a new one": no reset route   | passwords only; no passwords (A1 as it was)           |
| AC2 | Password rules                | 12–128 code points, any characters, not trimmed, no composition rules (NIST SP 800-63B); Better Auth's scrypt hash                                                                        | composition rules; 8-character minimum                |
| AC3 | Breached passwords            | Have I Been Pwned range API: only the first 5 hex characters of the SHA-1 leave the server (k-anonymity, `Add-Padding`); 1.5 s timeout, fails open; never logged. A fake in tests and dev | a bundled list (stale, large); no check               |
| AC4 | Step-up                       | A fresh code mailed to the **current** address before changing the e-mail, or setting, changing or removing the password                                                                  | current password (code-only accounts have none); none |
| AC5 | After e-mail/password changes | Every other session is revoked (phones and browsers); the one that made the change stays. A security mail goes to the old (or current) address                                            | keep sessions                                         |
| AC6 | Name                          | `users.display_name` is the one source (mirrored into `auth_users.name` in the same transaction). Rules in core `displayName()`: trimmed, NFC, ≤ 40 code points, no control characters    | name in `auth_users` only                             |
| AC7 | Staff                         | The admin portal may show "has password" and when it changed, never change a user's name, e-mail or password                                                                              | support-driven changes (account takeover path)        |
| AC8 | Web portal                    | The same flows in `/[locale]/account` are handed to the web-portal work (lane A); the routes below are what it codes against                                                              | building the web part here, in parallel with lane A   |

## Contract (additive; old clients keep working)

All routes need a signed-in **account** session; a device-token caller gets
`403 identity.account-required`. Field rules come from `@cityturfer/core/identity` (`displayName`,
`newEmail`, `newPassword`), so their error codes are the problem `code`s.

| Route                                 | Body → answer                                         | Errors                                                                                        |
| ------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /v1/me`                          | → `User` + `name`, `hasPassword`, `passwordChangedAt` | —                                                                                             |
| `PATCH /v1/me`                        | `{ name: string }` (blank clears) → `200 User`        | `display-name.too-long`, `display-name.invalid`                                               |
| `POST /v1/me/step-up/codes`           | `{}` → `202 {}` (mails a code to the current address) | `429 auth.rate-limited`                                                                       |
| `POST /v1/me/email/codes`             | `{ newEmail, stepUpCode }` → `202 {}`                 | `401 auth.invalid-code`, `email.invalid`, `email.unchanged`, 429                              |
| `POST /v1/me/email`                   | `{ newEmail, code }` → `200 User`                     | `401 auth.invalid-code`, `409 email.taken` (only after the new inbox's code proved ownership) |
| `PUT /v1/me/password`                 | `{ newPassword, stepUpCode }` → `204`                 | `401 auth.invalid-code`, `password.too-short`, `password.too-long`, `password.breached`       |
| `DELETE /v1/me/password`              | `{ stepUpCode }` → `204`                              | `401 auth.invalid-code`                                                                       |
| `POST /v1/auth/sign-in` (second body) | `{ email, password }` → `200 Session`                 | `401 auth.invalid-credentials` (same for a wrong password, no password, or no account)        |

- `User.displayName` stays (deprecated): `name ?? id`, for phones on older builds. New clients read
  `name` and show "You" when it is null.
- A step-up code is single use: `POST /v1/me/email/codes` spends it, the change-e-mail step then
  needs only the code from the new inbox. Codes: 6 digits, 10 minutes, 3 tries, A5's limits.
- `POST /v1/me/email/codes` answers 202 for a valid step-up code even when the new address belongs
  to another account (no enumeration); that inbox then gets a mail saying the address is in use.
- Password sign-in counts in the same failed-sign-in buckets as codes (A5).

## Privacy

No route logs a name, address, code, password or hash prefix. The breach check sends 5 hex
characters of a SHA-1 to `api.pwnedpasswords.com` with padding on; it is named in the privacy
policy. Passwords live hashed in `auth_accounts.password` and go with the account on `DELETE /v1/me`
(cascade). No migration: every column already exists.
