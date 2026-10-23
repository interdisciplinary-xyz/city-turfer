---
status: canonical
verified: 2026-10-23
owner: founder
scope: [apps/web, apps/api/src/middleware.ts, apps/api/src/routes/identity.ts]
summary:
  Web portal Slice 0 (trust page) — signed-in pages inside apps/web under /[locale]/account, static
  export kept, browser sessions by cookie (14 days sliding, 30 days absolute, 8 h on a shared
  computer), read-only apart from account actions; map and activities later
---

# Web portal: where it lives and how long a web session lasts

On 2026-10-22 the founder took the blocking decisions of the web portal plan ("Your turf on the
web", planned the same day by product-manager, api-engineer and web-engineer). This record holds the
answers; the plan holds the reasoning.

**Status (2026-10-23):** Slice 0 is built and shipped in v0.10.0 (#141): sign-in, Privacy & data
(what the server holds, export, delete account, signed-in devices) under
`apps/web/src/app/[locale]/account/`, plus `/[locale]/account/register` (#150). Slice 1 (map,
activities) is not built.

| #   | Decision           | Outcome                                                                                                                                                         |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Static export      | **Kept.** Portal pages are static shells; data is fetched in the browser after a client gate (`GET /v1/me`, 401 → sign-in). No personal data is server-rendered |
| D2  | First slice        | **Slice 0 only** on `feat/web-portal`: sign-in, sign-out, Privacy & data (consents, export, delete account, signed-in devices). Map and activities come later   |
| D3  | URL prefix         | **`/[locale]/account`**                                                                                                                                         |
| D4  | Web session length | **14 days sliding, 30 days absolute.** "This is a shared computer" makes it a browser-session cookie with an 8 h absolute limit                                 |

## Consequences

- **Public pages keep their promise.** Signed-out visitors get no cookies, API calls or third-party
  scripts. Only the portal sets one strictly necessary cookie, `__Host-ct_session`
  (`Path=/; HttpOnly; Secure; SameSite=Strict`; the prefix and path are W1 in
  `docs/decisions/api-web-sessions-2026-10-22.md`), and only the API reads it, through a same-site
  route `/api/v1/*` → the API, so there is no CORS.
- **Read-only apart from account actions.** Rename and delete of single activities stay on the phone
  until two-way sync: a web delete would leave a tombstone that deletes the phone's copy. Consents
  are shown, not changed, on the web. (`docs/decisions/data-flow-2026-10-23.md`, proposed for
  v0.11.0, would add web delete once the phone pulls changes; neither is built.)
- **CSRF:** cookie requests with an unsafe method need `Origin` = `WEB_ORIGIN`, a same-origin
  `Sec-Fetch-Site` and `CityTurfer-Client: web/<version>`, else 403 `auth.csrf`. Bearer (phone)
  requests are unaffected.
- Still open and owned by the plan: the privacy policy (PL + EN) before Slice 0 goes live, the
  cookie notice wording (D10), and proving the cookie and the client IP through the rewrite on a
  Vercel preview. Production deploy (Neon migration 0004, `WEB_EDGE_SECRET` / `WEB_ORIGIN`): pending
  (founder).
