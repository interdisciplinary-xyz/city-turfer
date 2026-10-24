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

| #   | Decision            | Outcome                                                                                                                                                                                                                                                                      |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LP1 | Where they back up  | **Production, by e-mail code.** On a local profile, Info › Cloud backup offers "Email me a code" to the profile's own address. The code links a real server account for that address to the profile (same profile id, same database)                                         |
| LP2 | The app password    | **Still opens the profile on the phone, never the server.** `admin1234` / `demo1234` are in the source, so they protect nothing on a server. A password sign-in opens the local data without a server session; backup waits until a new code                                 |
| LP3 | Demo history        | **Uploads, from the demo profile only**, as source `import` with its stable `demo-…` ids, so the web portal shows the phone's Gdańsk history. A `demo-…` activity on any other profile is still never uploaded                                                               |
| LP4 | Another phone       | Uploads go by id, so the server holds the union; the existing restore offer brings back what the phone lacks. Two phones on demo@ overwrite the same demo ids (acceptable for a screenshots profile)                                                                         |
| LP5 | E-mail and password | **Fixed on the local profiles.** Me › Account hides "change e-mail" and "set password" on admin and demo: the address is what the code proves, and the phone always opens these profiles with the app password (taken by the main session on review, 2026-10-24; reversible) |

## How it works

- Identity (`packages/core/src/contexts/identity`): a local profile becomes an account profile
  (`AccountProfileEntry` with `profileId` `admin` or `demo`) through a new use case that verifies
  the code and accepts only the profile's own e-mail (`linkOwn`). `demo` is never placed for another
  account's sign-in. The session goes to the existing single credential slot; sign-out revokes it.
- Password sign-in of a linked local profile opens it as today (no `linked-to-account` refusal for
  the profile's own address) and leaves no credentials, so the card offers the code again.
- Cloud backup: `available` whenever the context exists; `mayUpload` lets `demo-…` ids through only
  when the signed-in profile is `demo`.
- API: no functional change (it already accepts `demo-` ids as `import`); the contract text about
  demo history changes (0.6.1).

## Consequences

- Whoever reads admin@ and demo@cityturfer.com mail controls those server accounts and their
  location history. The mailboxes must exist and be read by the founder only.
- JS only: no new dependency or plugin, so it ships over the air.
- Needs the production API running (its environment variables were missing on 2026-10-24).
