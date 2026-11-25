---
status: proposed
verified: 2026-11-24
owner: founder
scope:
  [
    apps/mobile/src/contexts/route-planning,
    packages/core/src/contexts/territory,
    apps/mobile/src/app/plan-route.tsx,
    apps/mobile/src/platform/migrations.ts,
    apps/mobile/messages,
  ]
summary: >-
  Route planner, slice 1: the Turfer taps waypoints on their turf map, the route snaps to streets
  (opt-in, public OSRM), shows distance and the new turf it would claim, and becomes a guide line on
  the Record map. One active plan on the phone; auto loops and unclaimed-street hints later.
---

# Route planner

Founder decisions (2026-11-24): slice 1 is **tap waypoints**, street snapping behind an **opt-in
consent** (off until accepted), **one active plan** kept on the phone. Product framing from the
product-manager (Explore loop is the long-term value; O2 "I don't know where to go next" has no
evidence yet), architecture from rn-architect.

## Principles

- A Planned Route is intent, never turf: only moving claims cells. No "missed", "mission" or guilt
  copy.
- Not a Komoot clone: no route library, no turn-by-turn, no surface or elevation planning.
- Claimed cells never leave the phone: the new-turf estimate runs on the device.
- Waypoints are personal data (often home): sent to the router only after consent, rounded to 4
  decimals (~11 m), never logged, never backed up or synced.

## Slices

| Slice | What                                                                                 | Router      |
| ----- | ------------------------------------------------------------------------------------ | ----------- |
| 1     | Tap waypoints, snapped to streets; distance, time, ≈ new cells; guide line on Record | public OSRM |
| 1b    | After Finish: "{claimed} of {planned} planned cells are yours now"                   | —           |
| 2     | Unclaimed streets nearby: tile street lines minus claimed cells, on the phone        | none        |
| 3     | Explore loop: type + 30/45/60 min → a proposed loop with the most new turf           | self-hosted |

## Slice 1

**Flow.** Turf Map chip "Plan route" → `/plan-route`: dark map with turf layers. Pick walk, run or
cycle; tap to add waypoints; Undo, Clear, Close loop. A card shows distance, estimated time and "≈ N
new cells". The new cells along the route are outlined. "Use on Record" makes it the active plan;
the Record map draws it as a guide line under the live track (dismissable). The draft is saved after
every edit and restored after the app is killed. At most 30 Waypoints and 50 km in straight lines
(`MAX_ROUTE_M`), which also bounds the estimate; the Record guide reads the plan without the
estimate. Recording's behaviour is unchanged: `record-view` only gained an optional `mapChips` slot
(the Hide route chip), and Recording imports nothing from Route Planning.

**Consent.** The first time a route needs snapping, a sheet explains that waypoints go to
routing.openstreetmap.de. Declining, offline, 429 or timeout: those legs are straight dashed lines
("Not snapped to streets") and still scored. Toggle in Info.

**Architecture.**

- New app-only context
  `apps/mobile/src/contexts/route-planning/{domain,application,infrastructure,ui}` (+ `index.ts`,
  `contract.ts`), like Goals.
- Territory owns the turf rule: `cellsAlong(line, grid)` extracted from `Claim.fromTrack` (no
  behaviour change, turf vectors unchanged) and an `EstimateTurfGain` use case in
  `packages/core/src/contexts/territory`. Route Planning reaches it through its own
  `TurfGainEstimator` port, wired in `apps/mobile/src/wiring.ts`.
- Ports: `StreetRouter` (multi-waypoint OSRM, own fair-use budget), `PlannedRouteRepository`
  (SQLite), `RoutingConsent` (secure store), `TurfGainEstimator`.
- Migration v16: `rp_planned_routes`, one active row: type, waypoints, legs (`{path, snapped}`),
  `show_on_record`, timestamps. Distance comes from the geometry and the turf estimate is recomputed
  on every read (turf grows after each recording), so neither is stored. Personal data: not in cloud
  backup.
- JS-only: no `app.json`, plugin or native dependency change, so it ships as an OTA (confirm with
  the fingerprint check).

**Acceptance.**

| Criterion                                                                 | Proof                                 |
| ------------------------------------------------------------------------- | ------------------------------------- |
| `cellsAlong` gives the same cells as before the refactor                  | core Jest, `turf-vectors.json` intact |
| `EstimateTurfGain` separates known and new cells                          | core Jest                             |
| Router: multi-waypoint URL, rounded coordinates, 400/429/offline fallback | Jest with a fake fetch                |
| Plan survives v15 → v16 and an app restart                                | Jest on real SQL                      |
| Without consent nothing is sent; straight lines still score               | Jest                                  |
| Plan → Use on Record → replayed walk: recording intact, line visible      | simulator replay, screenshot          |
| Every string in en and pl                                                 | `audit:i18n`                          |

## Open

- FOSSGIS usage policy for multi-waypoint user-driven requests: re-read before release.
- A self-hosted router (budget, hosting) before slice 3 and before public launch.
- Privacy policy needs a line for route planning (the in-app disclosure is in Info › Your data and
  the consent sheet).
