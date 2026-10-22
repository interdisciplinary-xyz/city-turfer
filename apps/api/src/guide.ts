import { PROBLEM_CODES } from './errors';

/**
 * The guide at the top of the spec (Swagger UI renders `info.description` as markdown): getting
 * started, the sync flow, errors, units and privacy. Source of truth for the protocol:
 * docs/decisions/api-sync-2026-10-20.md.
 */

const gettingStarted = `## Getting started

- **Base URL:** pick a server above. Locally, \`pnpm --filter @cityturfer/api dev\` runs the API on port 8787 and \`pnpm run web:dev\` serves this page at https://cityturfer.local/swagger with the API under \`/api\`.
- **Status:** the one-way **backup** (phone → server) is live: health, \`/v1/me\`, consents, activity upload/read/delete, track, gap routes, the changes feed and the Home City. The rest is designed but **planned**: its summary starts with \`[planned]\`, it carries \`x-cityturfer-status: planned\` and answers \`501\` once auth and validation pass. Live data routes answer \`503 storage.unavailable\` when the server has no database.
- **Auth:** send \`Authorization: Bearer <device token>\` (button **Authorize**). Tokens are random secrets minted per user (\`pnpm --filter @cityturfer/api run token:new -- <userId>\`); the server stores only their SHA-256. A stopgap until Better Auth. A missing token answers \`401\` *before* the input is validated. Locally, \`dev-token\` works for user \`admin\` when \`API_TOKENS\` is not set.
- **Consent:** activity and Home City writes need \`PUT /v1/me/consents/cloud-sync\` with \`granted: true\` first (else \`403 consent.required\`); Apple Health activities also \`apple-health-in-cloud-sync\`.
- **Headers you send:** \`Content-Type: application/json\`; \`Content-Encoding: gzip\` for long tracks; \`If-Match\` to change an existing activity; \`CityTurfer-Client: ios/0.8.0+123\` (old clients may get \`426 client.too-old\`).
- **Headers you get:** \`X-Request-Id\` on every answer (quote it when reporting a problem), \`ETag\` on activities, \`Location\` on 201/202, \`Retry-After\` and \`RateLimit\` on 429.
- **Limits:** request and response bodies ≤ 4.5 MB (Vercel); ≤ 40,000 points per track; gzip bodies inflate to ≤ 16 MB.`;

const syncFlow = `## Sync flow (phone ↔ server)

The phone is local-first and authoritative for what it recorded; the server stores activities with their tracks and recomputes everything derived (summaries, turf). Writes are keyed by ids the phone mints, so every request can be retried.

**First upload of an existing history**
1. \`PUT /v1/me/consents/cloud-sync\` (and \`apple-health-in-cloud-sync\` to include Apple Health imports).
2. \`GET /v1/sync/changes\` without a cursor, every page: what the server already has (the manifest).
3. For each local activity, oldest first (never \`demo-…\`): absent → \`PUT /v1/activities/{id}\`; same \`trackHash\` → done; different → \`PUT\` with \`If-Match\`; tombstoned → delete it locally.
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
