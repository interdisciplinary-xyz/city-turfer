---
name: web-portal
description: >-
  The signed-in user portal in apps/web: public/portal boundary, browser sign-in and session cookie,
  typed API client and error codes, read-only backed-up data and activity history, privacy and
  checks. Use before changing account pages, src/api or portal E2E, or when asked "show my data on
  the web".
---

# Web portal (signed-in pages in apps/web)

Slice 0 (sign-in, sign-out, Privacy & data) is built. The decisions D1–D4 are in
`docs/decisions/web-portal-2026-10-22.md`, the browser session (W1–W11) in
`docs/decisions/api-web-sessions-2026-10-22.md`, the activity history (H1–H6) in
`docs/plans/web-portal-history-2026-10-23.md`. Decisions are taken there, never in this file. Build
only on decided ones. D5–D12 of the original portal plan (consents on the web, cells, tiles, cookie
wording, "sign out everywhere", domain…) are still recommendations: for any of them, ask.

## Where things live

| What                   | Path                                                                                                  | Owner                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Portal root (D3)       | `apps/web/src/app/[locale]/account/` (its `layout.tsx` mounts the query client and portal copy)       | `portal-engineer`                                  |
| Gated pages            | `apps/web/src/app/[locale]/account/(signed-in)/` (behind the session gate); `sign-in/`, `register/`   | `portal-engineer`                                  |
| Components             | `apps/web/src/app/[locale]/account/_portal/<name>/` (`<name>.tsx`, `<name>.constants.ts`, `index.ts`) | `portal-engineer`                                  |
| API client             | `apps/web/src/api/` (`client.ts`, `portal-api.ts`, `hooks.ts`, `errors.ts`, `schema.ts`)              | `portal-engineer`                                  |
| Portal stories         | `apps/storybook/src/stories/portal/` (made-up data in `fixtures.ts`)                                  | `portal-engineer`                                  |
| Portal E2E             | `apps/web/e2e/{portal,activities}.spec.ts`, `apps/web/e2e/support/`                                   | `portal-engineer`                                  |
| Copy                   | `portal.*` in `apps/web/messages/en.json` and `pl.json`                                               | wording: `brand-designer`; keys: `portal-engineer` |
| Route, CSP and headers | `apps/web/vercel.json`                                                                                | `web-engineer` edits, to `portal-engineer`'s spec  |
| Contract and cookie    | `apps/api/openapi.json` (generated), `apps/api/src/session-cookie.ts`, `apps/api/src/middleware.ts`   | `api-engineer`                                     |

In code, link through `PORTAL_ROOT` (`apps/web/src/api/next-path.ts`); the route folder,
`vercel.json`'s header source, `apps/web/tools/check-export.mjs` and the E2E also name `/account`.
In the harness say "the portal root".

## The public/portal boundary

Public pages keep the site's promise (the `web-motion` skill's Site ground rules): **no cookies, no
API calls, no third-party scripts for a signed-out visitor.** The portal never weakens that.

- Gates, not habits: `apps/web/.dependency-cruiser.cjs` (marketing code never imports the portal
  root, `apps/web/src/api/`, TanStack Query, openapi-fetch, maplibre-gl or `@cityturfer/core`
  (`marketing-not-core`); the portal uses core's shared kernel only
  (`portal-core-shared-kernel-only`), `@cityturfer/core/h3` only in the portal; the client never
  imports pages; no GSAP in the portal) and `apps/web/tools/check-export.mjs` after every build (no
  portal chunk, copy or `/api/v1` call on `/en`, `/pl`; portal pages noindex and not in the
  sitemap). If a rule is wrong, fix it and its test, never route around it.
- The shared `[locale]/layout.tsx` stays cookie-free and provider-free. The portal's client copy is
  only the namespaces in `PORTAL_CLIENT_NAMESPACES` (`account/layout.constants.ts`); add one there
  only if portal client components need it.
- D1: static shells. Data arrives in the browser after the gate (`GET /v1/me`, 401 → sign-in);
  nothing personal is rendered at build time.
- The portal CSP in `vercel.json` is `connect-src 'self'`, `img-src 'self' data: blob:`: any foreign
  request (tiles, fonts, scripts) is blocked, and the E2E fails on it.

## Auth and session in the browser

- Sign-in and "Create account" are one flow: `POST /v1/auth/codes`, then `POST /v1/auth/sign-in`
  with `client: "browser"` (and `sharedComputer`). The API sets `__Host-ct_session`
  (`Path=/; HttpOnly; Secure; SameSite=Strict`, no `Domain`) and leaves the token out of the body.
  **JS never sees the token.** Lifetimes (D4): 14 days sliding, 30 absolute, 8 h when shared.
- No token, session id or personal data in `localStorage`, `sessionStorage`, IndexedDB,
  `document.cookie` or URLs. The client fetches same-origin `/api/v1/*` with `cache: 'no-store'`; no
  CORS (Vercel `routes` in `vercel.json`; dev: `apps/web/server.mjs`).
- Every request sends `CityTurfer-Client: web/<version>`; unsafe ones also need the right `Origin`
  and `Sec-Fetch-Site`, else 403 `auth.csrf` (W4).
- **401 anywhere** (outside sign-in and sign-out) → `leave()` in `apps/web/src/api/leave.ts` clears
  the whole query cache and goes to sign-in; `?next=` only through `apps/web/src/api/next-path.ts`.
  A page restored from the back-forward cache clears it too.
- Nothing in apps/web assumes an admin or staff role.

## API client and errors

- Types come from `apps/api/openapi.json`: `pnpm --filter @cityturfer/web run api:types` writes
  `apps/web/src/api/schema.gen.ts`; name them in `schema.ts`. Never hand-write a request or response
  type; a unit test fails when the generated file is stale.
- Calls go through `portalApi()` in `portal-api.ts` (one per operation, via `unwrap`), pages use the
  hooks in `hooks.ts` (TanStack Query, in memory only, never persisted). Only `apps/web/src/api/`
  calls the API.
- Errors: `toPortalError` maps the problem `code` to `portal.errors.<code>` for the codes in
  `PORTAL_ERROR_CODES` (pinned to the contract's `ProblemCode`); others are `signed-out`,
  `unreachable` or `generic` (with the `X-Request-Id`). Never show `title` or `detail`, never echo
  input. Another user's id is a 404: say "not found".

## Data rules

- **Read-only** apart from account actions (export, delete account, signed-in devices, sign-out).
  Consents are shown, not changed. Rename and delete stay on the phone: a web delete is a tombstone
  that deletes the phone's copy (H3).
- **Only the backed-up copy**, and say so. Every page has its empty states (the history plan's list:
  backup never on, withdrawn, nothing uploaded yet, filter with no match, Apple Health not shared,
  unknown id, API unreachable).
- Caching is the API's (W8): personal answers `private, no-store`, `Vary: Cookie, Authorization`.
- **No coordinates or cell ids in URLs** (query, hash, path), logs, `console` or error reports. **No
  analytics.**
- The API sends SI units; convert only when formatting.

## Activity history (built, H1–H6)

- Pages under `(signed-in)/`: `/[locale]/account/activities` and `/[locale]/account/activity?id=`
  (H2: the static export can't prerender one page per id; the id is the phone's opaque id, checked
  with `apps/web/src/api/activity-id.ts` before any call; `?next=` and the language links keep only
  a valid `id`). Components in `_portal/` (`activities-page`, `activity-page`, `activity-list`,
  `activity-detail`, `route-svg`…), pure logic in `_portal/activity-time.ts`, `route-shape.ts` and
  `activity-numbers.ts`, tested in `apps/web/src/api/__tests__/activity-history.test.ts`.
- Gap routes: `afterSegment` is the core's index into the ordered segments, not a segment number.
- H1: the route is an **inline SVG of its shape, no basemap, no tiles**: the list from the summary's
  `preview`, the detail from the track simplified with core's `simplify`, GPS-gap estimates dashed.
- H4: distance, duration and pace or speed from `@cityturfer/core/shared-kernel` formatters (moved
  there from the app by `location-engineer`), so the numbers match the app. apps/web uses core's
  shared kernel only; never re-implement a formatter.
- H5: day and time in the activity's own `timeZone` (the browser's when null); months group by that
  local day. Dates elsewhere in the portal use `_portal/format.ts` (the visitor's zone). English
  pages format every date en-GB style (day first, 24-hour) through `dateLocale` in `format.ts`.
- H6: `GET /v1/activities` cursor pages of 50 with "Show more"; the type filter in page state, not
  the URL. Totals from `GET /v1/activity-totals`.

## The Turf Map (not built)

Open: D6 (how cells are fetched) and D7 (map tiles, the only third-party request, carrying viewport
positions). Until they are decided: no `maplibre-gl`, no tiles, no cells. When built, `maplibre-gl`
loads only on portal map pages through `next/dynamic(…, { ssr: false })`, cells are drawn through
`@cityturfer/core/h3` only (h3-js is never a dependency of apps/web), colours from
`@cityturfer/brand`, strength from core, and the CSP and the E2E allow-list change with it.

## Components

No `@cityturfer/ui` or react-native-web on the website: small web components styled from the brand
CSS variables (`account/portal.css`), each with a story. Every route shape has a text equivalent;
`prefers-reduced-motion` respected.

## Privacy

- A change that shows or collects personal data (tracks, e-mail, devices, consents, export,
  deletion): run the user-level `data-privacy-reviewer` skill and report its findings; for auth,
  cookies or headers also `appsec-engineer`.
- Test accounts are `@e2e.cityturfer.test` only; fixtures use made-up or public places.

## How to verify

```bash
pnpm exec turbo run typecheck lint arch build --filter=@cityturfer/web   # export + check-export
pnpm --filter @cityturfer/web test:unit                                  # client, errors, logic, tools
pnpm --filter @cityturfer/storybook build                                # portal stories render
pnpm --filter @cityturfer/web run test:e2e                               # needs a fresh build
```

- **E2E** (`apps/web/playwright.config.ts`): it serves the built `apps/web/out` over HTTPS with
  `vercel.json`'s route and headers (`apps/web/e2e/support/site-server.mjs`, self-signed localhost)
  in front of the API on an in-memory PGlite (`apps/web/e2e/support/api-server.mjs`), with
  `AUTH_FIXED_CODE=000000` for `@e2e.cityturfer.test` addresses. Once:
  `pnpm exec playwright install chromium`. Every test fails on a foreign request, an e-mail or a
  coordinate in a URL, or a CSP violation (`apps/web/e2e/support/fixtures.ts`). Cover sign-in, wrong
  code, 401 → sign-in, sign-out, every empty state, axe (no serious or critical), 320 px without
  horizontal scroll, and the landing invariants (`apps/web/e2e/landing.spec.ts`). Seed activities
  through the API's own upload routes, as a phone backup would
  (`apps/web/e2e/support/activities.ts`); the history spec runs in another browser zone than the
  activities' to prove H5.
- **By hand:** `pnpm --filter @cityturfer/api dev` (PGlite) and `pnpm run web:dev`, then sign in at
  https://cityturfer.local/en/account with `demo@cityturfer.com` (Gdańsk demo history) or
  `admin@cityturfer.com`, code 000000 (`apps/api/src/dev/mock-accounts.ts`).
- **Landing unchanged:** `node apps/web/tools/viewports.mjs --paths /en,/pl --reduced-motion`.

Never report the session as working from a plain-http run: `__Host-` cookies need HTTPS. The E2E
proves it locally; the rewrite, client IP and edge caching are proven only on a Vercel preview (the
"Open" list in `docs/decisions/api-web-sessions-2026-10-22.md`).
