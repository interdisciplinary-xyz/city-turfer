---
status: canonical
verified: 2026-10-24
owner: founder
scope:
  - packages/core/src/contexts/identity
  - apps/mobile/src/contexts/identity
  - apps/mobile/src/contexts/cloud-backup
  - apps/mobile/src/wiring.ts
  - apps/api/src/schemas/activities.ts
summary:
  The local profiles admin@ and demo@cityturfer.com can back up to the server after the Turfer
  proves the profile's mailbox with an e-mailed code; the app password still opens them on the
  phone, and the demo profile uploads its generated Gdańsk history
---

# Cloud backup for the local profiles (admin@, demo@)

Taken by the founder on 2026-10-24, after finding the Cloud backup switch disabled on the iPhone's
`admin@cityturfer.com` profile. Planned by rn-architect the same day.

| #   | Decision            | Outcome                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LP1 | Where they back up  | **Production, by e-mail code.** On a local profile, Info › Cloud backup offers "Email me a code" to the profile's own address. The code links a real server account for that address to the profile (same profile id, same database)                                                                                                                 |
| LP2 | The app password    | **Still opens the profile on the phone, never the server.** `admin1234` / `demo1234` are in the source, so they protect nothing on a server. A password sign-in opens the local data without a server session; backup waits until a new code                                                                                                         |
| LP3 | Demo history        | **The demo profile uploads only its plan**: the generated Gdańsk history, as source `import` with its stable `demo-gdansk-n<i>` ids, so the web portal shows it, and only to demo@'s own account. Its recordings, its Apple Health imports and any other `demo-…` activity stay on the phone (privacy-first, taken on review 2026-10-24; reversible) |
| LP4 | Another phone       | Uploads go by id, so the server holds the union; the existing restore offer brings back what the phone lacks. Two phones on demo@ overwrite the same demo ids (acceptable for a screenshots profile)                                                                                                                                                 |
| LP5 | E-mail and password | **Fixed on the local profiles.** Me › Account hides "change e-mail" and "set password" on admin and demo: the address is what the code proves, and the phone always opens these profiles with the app password (taken by the main session on review, 2026-10-24; reversible)                                                                         |

## How it works

- Identity (`packages/core/src/contexts/identity`): a local profile becomes an account profile
  (`AccountProfileEntry` with `profileId` `admin` or `demo`) through a new use case that verifies
  the code and accepts only the profile's own e-mail (`linkOwn`). `demo` is never placed for another
  account's sign-in. The session goes to the existing single credential slot; sign-out revokes it.
- Password sign-in of a linked local profile opens it as today (no `linked-to-account` refusal for
  the profile's own address) and leaves no credentials, so the card offers the code again.
- Cloud backup: `available` whenever the context exists; on the `demo` profile `mayUpload` lets only
  the planned Gdańsk ids (`isGdanskPlanActivityId` from `@cityturfer/core/demo`) through, recordings
  and `hk-…` included in what it keeps back; on any other profile no `demo-…` id goes up. The same
  rule decides what is queued, what the full comparison sends, and the card's counts (`total`,
  `backedUp`, and `unsynced`, which counts only work that will go up, deletes included). The demo
  profile takes only Identity's account session (demo@'s, linked by a code), never a Developer tools
  device token.
- After the code, Cloud Backup's `afterCredentials` use case decides (not the screen): turn backup
  on only when it was off with nothing pending; carry on when it was on; deliver a pending
  withdrawal and stay off. It decides "carry on" only once connected: if the address's account is a
  new one, backup is off for it and the screen asks for "Turn on backup" (the consent tap).
- API: no functional change (it already accepts `demo-` ids as `import`); the contract text about
  demo history changes (0.6.1).

## Consequences

- Whoever reads admin@ and demo@cityturfer.com mail controls those server accounts and their
  location history. The mailboxes must exist and be read by the founder only.
- JS only: no new dependency or plugin, so it ships over the air.
- Needs the production API running (its environment variables were missing on 2026-10-24).

## Review outcomes (PR #165, 2026-10-24)

Code review by mobile-reviewer, api-engineer, mobile-test-engineer and brand-designer; fixed by
api-engineer (logic) and mobile-ui-engineer (copy and card) before merge.

- **Developer tools seeder on the demo profile (privacy, fixed).** Its `demo-<ms>` tracks are
  centred on the phone's real position; the demo profile let every `demo-…` id through. Now only
  `demo-gdansk-n<i>` uploads. Rejected: a new prefix for the seeder (the old prefix would still be
  on phones that seeded before).
- **Recordings on the demo profile (privacy, fixed on scope review, PR #160).** `mayUpload` let
  every recording through on any profile, so a real walk recorded while signed in as demo@ (for
  record-screen screenshots) put real coordinates on the shared demo@ account and its web portal;
  the same for Apple Health imports once included. Now the demo profile uploads only the plan (LP3).
  Rejected: uploading them with a warning on the card (the account is shared by whoever reads its
  mailbox, and the screenshots need no server copy), and a separate "back up recordings" switch on
  the demo profile (more surface for a screenshots profile). Reversible: one branch in `mayUpload`;
  a full comparison would then queue what stayed on the phone.
- **Revoked or expired session (fixed).** The keychain kept the dead session, so the card said "sign
  in again", which on a local profile only opens the phone's data (LP2). With `lastError` `auth` on
  a linkable profile the card offers the code again; linking replaces the dead session and
  `afterCredentials` clears the error.
- **The consent rule moved out of `ui/` (fixed)**: `AfterCredentialsArrived` in Cloud Backup's
  application layer, `afterCredentialsPlan` exported for the button label.
- **New account behind the address (fixed).** Deleted on the web and made anew by the next code: the
  first run reset backup to off and the Turfer was told nothing. Now `needs-consent`, answered by
  the Turfer's "Turn on backup". Rejected: turning it on silently (a consent the Turfer did not give
  for that account).
- **Device token on the demo profile (fixed)**: refused, so the Gdańsk history never goes to
  whichever user a token maps to.
- **A withdrawal for the address's former account (fixed).** It blocked backup forever (no token
  reaches a deleted account). On a local profile linked to another account of the built-in server,
  when every token here answers 401 or names another account, the former account is taken as gone
  and the switch goes ahead; offline or server errors still keep the withdrawal. The same applies if
  that account only moved to another address (rare; its owner deletes the copy on the web).
  Rejected: a server route that says whether an account id exists (an enumeration oracle).
- **An expired code reads as a wrong one: kept.** The server answers both with `auth.invalid-code`
  (401), and the copy already says "Check the latest email, or send a new code", which fits both.

## Open for the founder

- **Code mails on request.** The mock passwords are public, so anyone can open an empty admin@ or
  demo@ profile on their phone and press "Email me a code": it mails the founder's inbox and uses up
  the one-a-minute limit. Accept it, or rate-limit these two addresses harder on the server.
- **Mailbox ownership.** Whoever reads admin@ and demo@cityturfer.com controls those accounts and
  their location history: confirm the mailboxes exist and only the founder reads them.
- **Web deletes on the demo profile.** Deleting a demo activity on the web leaves a tombstone that
  deletes it on the phone; the phone's demo seeding then puts it back and uploads it again. Fine for
  a screenshots profile, or should the demo seed respect tombstones?
- **Recordings on the demo profile.** Taken privacy-first on review: they stay on the phone (LP3).
  Reverse it if demo@ should back up real recordings too. Recordings that went up from a demo
  profile before this fix stay on demo@'s server account until deleted there (on the web) or the
  backup is turned off.
