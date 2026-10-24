import { PROBLEM_CODES } from './errors';

/**
 * The guide at the top of the spec (Swagger UI renders `info.description` as markdown): getting
 * started, the sync flow, errors, units and privacy. Source of truth for the protocol:
 * docs/decisions/api-sync-2026-10-20.md.
 */

const gettingStarted = `## Getting started

- **Base URL:** pick a server above. Locally, \`pnpm --filter @cityturfer/api dev\` runs the API on port 8787 and \`pnpm run web:dev\` serves this page at https://cityturfer.local/swagger with the API under \`/api\`.
- **Status:** sign-in, backup and restore are live: health, auth, \`/v1/me\`, consents, activity upload/read/rename/delete, track, gap routes, the changes feed, the Home City, the data export (e-mailed link), account settings (name, e-mail, optional password), account deletion, activity totals and server turf (summary, every cell, the claim of an activity: recomputed from uploaded tracks). Every route is live today; a route added ahead of its build is **planned**: its summary starts with \`[planned]\`, it carries \`x-cityturfer-status: planned\` and answers \`501\` once auth and validation pass. Live data routes answer \`503 storage.unavailable\` when the server has no database.
- **Auth:** \`POST /v1/auth/codes\` with an e-mail, then \`POST /v1/auth/sign-in\` with the 6-digit code from the e-mail: the answer's \`token\` goes in \`Authorization: Bearer <token>\` (button **Authorize**) for about 60 days (sliding); \`DELETE /v1/auth/session\` signs out. An account with a password may sign in with \`{ email, password }\` instead of the code. **The website** signs in (code or password) with \`client: "browser"\` and gets an \`HttpOnly\` cookie (\`__Host-ct_session\`, \`Path=/\`) instead of a token: 14 days sliding, at most 30 (8 hours with \`sharedComputer\`); its writes need \`Origin\` = the website and \`CityTurfer-Client: web/<version>\` (else \`403 auth.csrf\`). \`GET /v1/auth/sessions\` lists the signed-in phones and browsers. Device tokens (\`API_TOKENS\`) keep working for one more release. A missing token answers \`401\` *before* the input is validated. Locally the dev server prints the code (and with \`AUTH_FIXED_CODE=000000\`, addresses \`@e2e.cityturfer.test\` sign in with \`000000\`); \`dev-token\` works for user \`admin\` on PGlite.
- **Account settings:** \`PATCH /v1/me\` changes the name. A new e-mail or setting, changing or removing the password first needs a step-up code: \`POST /v1/me/step-up/codes\` mails one to the current address, the change spends it. Afterwards every other session (phones and browsers) is signed out; the one making the change stays. Device tokens get \`403 identity.account-required\`.
- **Consent:** activity and Home City writes need \`PUT /v1/me/consents/cloud-sync\` with \`granted: true\` first (else \`403 consent.required\`); Apple Health activities also \`apple-health-in-cloud-sync\`.
- **Headers you send:** \`Content-Type: application/json\`; \`Content-Encoding: gzip\` for long tracks; \`If-Match\` to change an existing activity; \`CityTurfer-Client: ios/0.8.0+123\` (old clients may get \`426 client.too-old\`; the website sends \`web/<version>\`).
- **Headers you get:** \`X-Request-Id\` on every answer, \`Cache-Control: private, no-store\` (unless a route says otherwise) and \`Vary: Cookie, Authorization\` on every \`/v1\` answer (quote it when reporting a problem), \`ETag\` on activities, tracks and \`/v1/turf/cells\` (send it back as \`If-None-Match\`: \`304\` when unchanged), \`Location\` on 201/202, \`Retry-After\` and \`RateLimit\` on 429.
- **Turf on the web:** download every cell with \`GET /v1/turf/cells\` (pages of up to 50,000 \`[h3Id, walk, run, cycle]\`, follow \`nextCursor\`; \`410 turf.changed\` mid-way → start again), keep its \`ETag\` and revalidate with \`If-None-Match\`. No bounding box or coordinates in any URL.
- **Limits:** request and response bodies ≤ 4.5 MB (Vercel); ≤ 40,000 points per track; gzip bodies inflate to ≤ 16 MB.`;

const syncFlow = `## Sync flow (phone ↔ server)

The phone is local-first and authoritative for what it recorded; the server stores activities with their tracks and recomputes everything derived (summaries, turf). Writes are keyed by ids the phone mints, so every request can be retried.

**First upload of an existing history**
1. \`PUT /v1/me/consents/cloud-sync\` (and \`apple-health-in-cloud-sync\` to include Apple Health imports).
2. \`GET /v1/sync/changes\` without a cursor, every page: what the server already has (the manifest).
3. For each local activity, oldest first (\`demo-…\` only from the demo profile, as \`import\`): absent → \`PUT /v1/activities/{id}\`; same \`trackHash\` → done; different → \`PUT\` with \`If-Match\`; tombstoned → delete it locally.
4. \`PUT /v1/activities/{id}/gap-routes\` once the phone checked the gaps (an empty list when there are none); \`PUT /v1/turf/home-city\`.
5. Keep the last \`nextCursor\`.

**Restore to a new phone**
1. Sign in; \`GET /v1/sync/changes\` without a cursor while \`hasMore\` (entries carry ids, names, versions and \`trackHash\`, no geometry; a page ends at \`limit\` or about 1 MB).
2. Per activity: \`GET /v1/activities/{id}\` (summary, gap routes, \`gapsCheckedAt\`) and \`GET /v1/activities/{id}/track\`. Store them as restored: never upload them back.
3. Apply tombstones and the Home City; keep the last \`nextCursor\`.

**Every day after**
- **Push** from the outbox: recorded → \`PUT\`; track corrected → \`PUT\` + \`If-Match\`; renamed → \`PATCH\`; deleted → \`DELETE\`; gaps estimated → \`PUT …/gap-routes\`; Home City → \`PUT /v1/turf/home-city\`.
- **Pull** on launch and foreground: \`GET /v1/sync/changes?cursor=…\` while \`hasMore\`; fetch \`GET /v1/activities/{id}/track\` (with \`If-None-Match\`) only when \`trackHash\` is new; apply tombstones by deleting locally. Pull **before** importing from Apple Health, so a workout recorded on another phone is not imported twice.

**Conflicts:** same content → \`200\` (replay). Stale \`If-Match\` → \`412\`: pull, re-apply, retry. Different content without \`If-Match\` → \`428\`. Deleted id → \`410 activity.deleted\`: delete wins. Renames and the Home City: last write wins. Invalid cursor → \`410 sync.cursor-expired\`: start again without one.`;

const errors = `## Errors

Every error is \`application/problem+json\` (RFC 9457) with a stable \`code\`. \`detail\` is for people and never repeats input values; a \`400\` lists JSON pointers in \`errors[]\`.

| code | status | meaning |
| --- | --- | --- |
${Object.entries(PROBLEM_CODES)
  .map(([code, { status, title }]) => `| \`${code}\` | ${status} | ${title} |`)
  .join('\n')}`;

const conventions = `## Units and formats

JSON in camelCase. SI units with a suffix (\`distanceM\`, \`movingS\`, \`areaKm2\`). Timestamps ISO 8601 UTC; an activity may carry its IANA \`timeZone\` for display — the server derives nothing from local time. Coordinates \`[lon, lat]\` (GeoJSON order); bounding boxes \`[west, south, east, north]\`. Track points \`[lon, lat, t, segment, altitudeM]\`. \`trackHash\` = SHA-256 hex of \`JSON.stringify(track.points)\` (no whitespace, ECMAScript number formatting, upload order); the server computes it, so sending it is optional. Turf cells are H3 indexes (resolution 11).`;

const privacy = `## Privacy

GPS tracks, turf cells and the Home City are personal data. Cloud sync needs the \`cloud-sync\` consent; everything can be exported (\`POST /v1/me/exports\`) and erased (\`DELETE /v1/me\`). Nothing of it is logged: logs hold the route pattern, status, duration, request id and user id. Examples on this page use public landmarks (Warsaw Old Town).`;

export const API_GUIDE = [
  "The CityTurfer HTTP API: the app's use cases over HTTP, to back up and sync a local-first phone and, later, other clients.",
  gettingStarted,
  syncFlow,
  errors,
  conventions,
  privacy,
].join('\n\n');
