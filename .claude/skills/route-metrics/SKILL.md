---
name: route-metrics
description:
  Formulas and conventions for TurfTrack activity statistics — haversine distance, elapsed vs moving
  time, pace (min/km) vs speed (km/h) per activity type, km splits, elevation gain with smoothing
  and hysteresis, calories (MET), and route simplification (Douglas–Peucker) for map rendering. Use
  when writing or changing anything in src/shared-kernel/ (track-analyzer, geo, track), when stats
  look wrong ("distance too long", "pace jumps", "elevation gain is huge"), or when adding a new
  stat.
---

> **Where the code lives** (see `docs/poc-plan.md`): the maths is in `src/shared-kernel/` —
> `analyzeTrack`, `elevationGain` and `simplify` in `src/shared-kernel/track-analyzer.ts`, haversine
> `distanceM` in `src/shared-kernel/geo.ts`, segments and `splitAtGaps` in
> `src/shared-kernel/track.ts`. Display formatting is in `src/ui-kit/format.ts`.

# Route metrics

All of the metrics code in `src/shared-kernel/` is **pure TypeScript with no React or Expo
imports**, uses SI units (m, s, m/s), and has unit tests. The reference implementation is
`tools/lib/geo.mjs` and `tools/route-stats.mjs`. The app's output must match it within tolerance on
the fixtures in `tools/fixtures/`.

## Definitions

- **distance**: Sum of haversine distances between consecutive _accepted_ points **within the same
  segment**. Never connect the last point before a pause to the first point after it if the gap
  exceeds 100 m: that's a jump, not movement.
- **elapsed time**: `ended_at − started_at` (wall clock).
- **moving time**: Sum of `dt` between consecutive points where speed ≥ the profile's moving
  threshold and the session is not paused.
- **pace**: `moving_time / (distance / 1000)` → s/km. Shown as `m:ss /km` for walk and run.
- **speed**: `distance / moving_time` → m/s, shown as km/h for cycle.
- **current pace/speed**: Rolling window over the last 30 s (walk/run) or 10 s (cycle). Never
  instantaneous: it jumps around.
- **splits**: For every whole km, the moving time spent in that km. Interpolate the crossing time
  between the two points that straddle the boundary.
- **elevation gain/loss**: See below.
- **calories**: `MET × weight_kg × moving_hours`. MET: walk 3.5, run `≈ 1.0 × km/h` (clamp 6–16),
  cycle 4 + 0.5 × max(0, km/h − 10), clamp ≤ 16. Show only when the user has entered a weight.

## Elevation (the tricky one)

Raw GPS altitude error is ±10–20 m and drifts slowly. Summing raw deltas overstates gain by 2–5×.
You can see it in the fixtures: `node tools/gen-route.mjs --type run --km 5 --format json` reports a
true gain of ~63 m, while `route-stats.mjs` on the same GPX reads ~200 m.

In order of preference:

1. **Barometer** (`expo-sensors` `Barometer`; iOS also reports `relativeAltitude`): use its relative
   changes for gain/loss and GPS only as an absolute offset. Record the pressure per point when it's
   available.
2. **GPS with smoothing**: 5-point moving average, then hysteresis. Count a climb only once altitude
   has moved ≥ `elevHysteresis` (3 m walk/run, 5 m cycle) from the last reference point. Ignore
   points with `altitudeAccuracy > 15` when that field is available.
3. Later: correct with a DEM service. Out of scope for v1.

Label elevation as approximate in the UI unless it came from the barometer.

## Simplification for display

A 2-hour ride at 1 Hz has 7,200 points, too many for a smooth `<Polyline>`. Use Douglas–Peucker with
an epsilon of ~3 m (computed in local metres via an equirectangular projection around the route's
centroid) for the detail map, and ~15 m for history-list thumbnails. **Never simplify the stored
data.** Simplify only at render time, and memoise the result.

## Formatting (src/ui-kit/format.ts)

- Distance: `< 1 km` → `850 m`; otherwise `5.24 km` (2 decimals under 100 km).
- Duration: `m:ss` under an hour, `h:mm:ss` from one hour up.
- Pace: `5:20 /km`; `—` when distance < 50 m (pace isn't meaningful yet).
- Units come from a setting (metric/imperial). Convert only in format functions.

## Testing checklist for a metrics change

```bash
node tools/gen-route.mjs --type run --km 5 --outliers 4 --pause 90 --format json > /tmp/run.json  # has truth.*
node tools/route-stats.mjs tools/fixtures/run-5k-outliers-pause.gpx --json                         # oracle
npx jest src/shared-kernel src/contexts/activity-log
```

Each metric function needs tests for: an empty input, a single point, two identical points, a
fixture compared with the oracle (distance within ±2%, moving time within ±5 s), and a pause in the
middle.
