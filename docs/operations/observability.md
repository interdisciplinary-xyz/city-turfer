---
status: canonical
verified: 2026-10-23
owner: founder
scope:
  [
    apps/mobile/src/platform/diagnostics.ts,
    apps/mobile/src/wiring.ts,
    apps/mobile/src/contexts/recording/infrastructure,
    apps/api/src/middleware.ts,
    tools/audit-logs.mjs,
    tools/chain/run.mjs,
  ]
summary:
  What the app and the API record about themselves, the no-coordinates rule, on-device diagnostics,
  API request logs and the audit:logs check
---

# Observability and the location privacy rule

CityTurfer records where people walk, run and ride. `CLAUDE.md` is explicit: location data is
personal data, so there is **no analytics on coordinates and no raw coordinates in logs in
production builds**. There is no remote telemetry from the app: no Sentry, no analytics SDK. The
app's observability is on-device, in the user's own SQLite database; the API (only for people who
turn on Cloud backup) writes one log line per request on Vercel (§5).

Adapted from the idea behind empatalk's `docs/operations/OBSERVABILITY.md` (a fixed tag taxonomy
that keeps dashboards trustworthy), applied to privacy instead of dashboards.

## 1. Field diagnostics (`apps/mobile/src/platform/diagnostics.ts`)

`Diagnostics.log(kind, data)` writes one row to `sys_diagnostics` (`at`, `kind`, `data` as JSON) in
the signed-in user's database (`turftrack-<uid>.db`). It exists to answer "why do points go
missing?" for background tracking. It records **counts, app state and timings, never positions**.
Writes are fire-and-forget (a failed write never affects recording).

| Kind          | Emitted from                                                                                     | Records                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `launch`      | `composition-root.ts` (container created)                                                        | app state (background means a headless relaunch), tracker running, Always and Precise permission, bg session availability, live streaming, Low Power Mode                                                      |
| `app-state`   | `ui-kit/app-context.tsx` (AppState change)                                                       | new app state, bg session active, live streaming, Low Power Mode                                                                                                                                               |
| `batch`       | `recording/infrastructure/location-batch-handler.ts` (payload described in `background-task.ts`) | source, app state, bg session, fixes received, age of the oldest fix in seconds, worst horizontal accuracy in metres, accepted count, session status, Fix Filter report counts (or the non-ingest result kind) |
| `task-error`  | background task, batch handler, `wiring.ts` (outbox dead letters, Health import, maintenance)    | an error `code` and `message` (the error text, see risks below)                                                                                                                                                |
| `maintenance` | `wiring.ts` (one-off data repairs)                                                               | job name and repair counts                                                                                                                                                                                     |
| `backup`      | `wiring.ts` (a Cloud Backup run that did something)                                              | the run's counts (uploaded, deleted, failed, refused) and its error kind; no ids, names or coordinates                                                                                                         |
| `tracker`     | declared in the type, no emitter today                                                           | reserved for tracker lifecycle events                                                                                                                                                                          |

Adding a kind: extend the union in `diagnostics.ts`, add a row here, keep the payload to counts,
states, durations and metres.

### Retention

`Diagnostics.prune()` deletes rows older than **14 days**, called once per container creation at
launch. Rows never leave the device on their own. Reading them off a phone is a manual, consented
step (`apps/mobile/tools/device-diagnose.sh`, `apps/mobile/tools/diagnose-recording.mjs`); ask the
owner before copying app data off their device.

### Risks to keep in mind

- `task-error.message` is `String(error)`: native errors normally contain no positions, but treat
  them as untrusted text. If an error type ever embeds a Fix, sanitise it before logging.
- The `batch` payload spreads the Fix Filter report. Only counts belong in that report.

## 2. Console output

- `console.*` is allowed only behind `if (__DEV__)` (stripped from production behaviour). Today the
  guarded `console.warn` calls are in the background task, the outbox and `apps/mobile/src/i18n/` (a
  missing translation).
- `tools/` is not part of the shipped app and may print; the audit only covers `apps/mobile/src/`.

## 3. Enforcement: `pnpm run audit:logs`

`tools/audit-logs.mjs` runs in `ci:quality` and fails on:

1. any `console.*` in `apps/mobile/src/` not guarded by `__DEV__`;
2. any `diagnostics.log(...)` payload that names `lat`, `lon`, `latitude`, `longitude`, `coords` or
   `coordinate(s)` (identifiers are split on camelCase and underscores, so `firstLat` and
   `start_latitude` are caught, `latency` and `colon` are not).

It is a regex audit, not an AST: spread payloads are not inspected and tests are skipped. It
complements, not replaces, code review.

**Allow-list:** a comment on the same line or the line above:

```ts
// audit-logs-allow: `l.coords.accuracy` is a horizontal accuracy in metres, not a position
container.diagnostics.log('batch', { ... });
```

The justification is mandatory (an empty one fails the audit). Every allow-list entry is a review
item; there are none today (the `batch` payload's accuracy figure is built in `describe` in
`background-task.ts` and spread into the call, which the audit doesn't inspect).

## 4. Future: error tags by bounded context

If remote error reporting (for example Sentry) is ever added, it must be opt-in, strip location data
before send, and use a **closed tag set** so reports stay comparable, as empatalk does with its
`domain` tag. Proposed:

| Tag         | Values                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `context`   | `identity`, `recording`, `activity-log`, `territory`, `achievements`, `health-sync`, `cloud-backup`, `platform`, `shared-kernel`, `app` |
| `layer`     | `domain`, `application`, `infrastructure`, `ui`                                                                                         |
| `operation` | use case or handler name (for example `IngestFixes`, `ProjectClaims`)                                                                   |
| `source`    | `foreground`, `background-task`, `maintenance`, `event-handler`                                                                         |

Rules for that future integration: never attach Fixes, Track Points, route geometry, H3 cells or
user email; scrub breadcrumbs; keep the tag set audited by a script like `audit:logs`. Until then
this section is design intent only.

## 5. The API's logs

`apps/api` writes one JSON line per request (`logRequests` in `apps/api/src/middleware.ts`): request
id, method, route pattern, status and duration. Never bodies, ids, coordinates or tokens. An
unexpected error adds a `request.error` line with the error class and code, never its message
(`docs/operations/api-deploy.md`, Check). `turf:backfill` and `turf:rebuild` print counts only.
`pnpm test:chain` fails when the API's log holds anything that looks like a coordinate
(`tools/chain/run.mjs`). `audit:logs` covers `apps/mobile/src/` only, not the API.
