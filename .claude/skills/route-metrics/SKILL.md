---
name: route-metrics
description: >-
  Use when stats look wrong ("distance too long", "pace jumps", "elevation gain is huge"), when
  adding a stat, or when changing packages/core/src/shared-kernel/ (track-analyzer, geo, track):
  distance, moving time, pace/speed, splits, elevation, simplification.
---

> **Where the code lives**: the maths is in `@cityturfer/core` (`packages/core/src/shared-kernel/`,
> re-exported by the app's `@/shared-kernel` shim) — `analyzeTrack`, `elevationGain` and `simplify`
> in `packages/core/src/shared-kernel/track-analyzer.ts`, haversine `distanceM`, `interpolate` and
> `boundingBoxOf` in `packages/core/src/shared-kernel/geo.ts`, `TrackPoint`, `trackFromPoints` and
> `splitAtGaps` in `packages/core/src/shared-kernel/track.ts`. Per-type thresholds
> (`MOVING_SPEED_MPS`, `ELEV_HYSTERESIS_M`, `MAX_FIX_GAP_MS`) are in
> `packages/core/src/constants/tracking.ts`. The Activity summary is derived in
> `packages/core/src/contexts/activity-log/domain/activity.ts`. Display formatting is in
> `apps/mobile/src/ui-kit/format.ts`.

# Route metrics

All of the metrics code in `packages/core/src/shared-kernel/` is **pure TypeScript with no React or
Expo imports**, uses SI units (m, s, m/s), and is tested. The reference implementation is
`apps/mobile/tools/lib/geo.mjs` and `apps/mobile/tools/route-stats.mjs`. The app's output must match
it within tolerance on the fixtures in `apps/mobile/tools/fixtures/`
(`apps/mobile/src/shared-kernel/__tests__/oracle-parity.test.ts` drives a `RecordingSession` with
the fixtures and compares).

## Definitions (built)

- **segment**: a run of Track Points that may be joined by a line. A new segment starts on every
  manual Resume and after a gap of more than `MAX_FIX_GAP_MS` (45 s) without fixes (Recording does
  this live; `splitAtGaps` re-applies it to stored or imported tracks).
- **distance**: sum of haversine distances between consecutive _accepted_ points **within the same
  segment**. Never across a segment boundary: that's a jump, not movement. (Activity Log can add a
  separately stored, street-routed _estimate_ for gaps: `estimated_m`, display only, never turf.)
- **elapsed time**: for an Activity, `endedAt − startedAt` (wall clock, set in `activity.ts`
  `derive`). `analyzeTrack`'s own `elapsedS` is last point − first point; the Activity overrides it.
- **moving time**: sum of `dt` between consecutive points of a segment where the implied speed ≥ the
  type's `MOVING_SPEED_MPS` (walk 0.5, run 1.0, cycle 1.5 m/s). Paused time has no points, so it
  never counts.
- **pace**: `moving_time / (distance / 1000)` → s/km. Shown as `m:ss /km` for walk and run
  (`usesPace(type)`).
- **speed**: `distance / moving_time` → m/s, shown as km/h for cycle.
- **splits**: for every whole km, the moving time spent in that km (`{ km, seconds }`). Today a
  split closes at the first point past the boundary; interpolating the crossing time between the two
  straddling points is a planned refinement.
- **elevation gain**: see below. Elevation loss is not computed.

Planned, not built:

- **current pace/speed**: rolling window over the last 30 s (walk/run) or 10 s (cycle). Never
  instantaneous: it jumps around.
- **calories**: `MET × weight_kg × moving_hours`. MET: walk 3.5, run `≈ 1.0 × km/h` (clamp 6–16),
  cycle 4 + 0.5 × max(0, km/h − 10), clamp ≤ 16. Show only when the user has entered a weight.

## Elevation (the tricky one)

Raw GPS altitude error is ±10–20 m and drifts slowly. Summing raw deltas overstates gain by 2–5×.
You can see it in the fixtures:
`node apps/mobile/tools/gen-route.mjs --type run --km 5 --format json` reports a true gain of ~63 m,
while `route-stats.mjs` on the same GPX reads ~200 m.

Built (`elevationGain`): per segment, a 5-point moving average, then hysteresis. A climb counts only
once altitude has moved ≥ `ELEV_HYSTERESIS_M` (3 m walk/run, 5 m cycle) from the last reference
point. Segments with fewer than 5 altitudes are skipped; no altitude at all → `null`.

Planned, in order of preference:

1. **Barometer** (`expo-sensors` `Barometer`; iOS also reports `relativeAltitude`): relative changes
   for gain/loss, GPS only as an absolute offset; store pressure per point (needs a migration).
2. Ignore points with `altitudeAccuracy > 15` (`Fix` doesn't carry that field yet).
3. Correct with a DEM service.

Label elevation as approximate in the UI unless it came from the barometer.

## Simplification for display

A 2-hour ride at 1 Hz has 7,200 points, too many to draw smoothly. `simplify(points, epsilonM)` is
Douglas–Peucker in local metres (equirectangular projection around the first point's latitude).
**Never simplify the stored data.**

- Built: the Activity `preview` (ε = 15 m, coordinates rounded to 5 decimals) is computed once when
  the Activity is saved and returned by `list()`; the Turf Map draws every track from it.
- Planned: route thumbnails in the history list (from `preview`) and a finer (~3 m) simplification
  for the activity detail map, memoised at render time.

## Formatting (`apps/mobile/src/ui-kit/format.ts`)

- Distance: `< 1 km` → `850 m`; otherwise `5.24 km` (`formatDistance`, `distanceText`).
- Duration: `m:ss` under an hour, `h:mm:ss` from one hour up (`formatDuration`).
- Pace: `5:20 /km`; `—` when distance < 50 m (`formatPaceOrSpeed`, `formatSpeedNow`).
- Metric only today. A metric/imperial setting is planned; convert only in format functions.

## Testing checklist for a metrics change

```bash
node apps/mobile/tools/gen-route.mjs --type run --km 5 --outliers 4 --pause 90 --format json > /tmp/run.json  # has truth.*
node apps/mobile/tools/route-stats.mjs apps/mobile/tools/fixtures/run-5k-outliers-pause.gpx --json          # oracle
pnpm -C apps/mobile exec jest src/shared-kernel     # oracle parity (drives RecordingSession)
pnpm --filter @cityturfer/core run test:unit        # Activity Log domain + use cases, Territory
```

Each metric function needs tests for: an empty input, a single point, two identical points, a
fixture compared with the oracle (distance within ±2%, moving time within ±5 s), and a pause in the
middle.
