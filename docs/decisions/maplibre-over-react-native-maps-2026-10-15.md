---
status: canonical
verified: 2026-10-17
owner: founder
scope:
  [
    src/contexts/territory/ui,
    src/constants/map.ts,
    plugins/with-local-maplibre.js,
    tools/fetch-maplibre-ios.sh,
  ]
summary: Decision record — MapLibre + OpenFreeMap for every map instead of react-native-maps
---

# Decision: MapLibre + OpenFreeMap instead of react-native-maps

> **Status:** Decided — adopted, shipped in v0.1.0.
>
> **Date:** 2026-10-15
>
> **Decider:** Founder + Claude, while writing the PoC plan (v2 of `docs/poc-plan.md`).
>
> **Re-evaluation trigger:** any one of: the Turf Map misses the Q4 budget on a mid-range Android
> phone (opens in > 1.5 s or stutters with a year of history); OpenFreeMap's public tiles become
> unreliable or change terms; we need a map feature MapLibre RN can't provide.

## TL;DR

**Use `@maplibre/maplibre-react-native` for every map, with keyless OpenStreetMap vector tiles from
OpenFreeMap and a dark style on the Turf Map.** The Turf Map is the product, and its look — a
heatmap glow when zoomed out, blurred overlapping tracks that brighten where you repeat, thousands
of strength-coloured cells — needs GPU, data-driven styling. react-native-maps can't do heatmaps or
blur and renders each polygon as a native object. MapLibre also removes the need for a Google Maps
API key.

## 1. Context

- The PoC must prove the Turf Map works and feels rewarding (Q3) and stays fast as history grows
  (Q4: ~200 activities, ~50k cells in a year).
- The planned layers (`docs/poc-plan.md` §5, built in `src/contexts/territory/ui/layers.tsx`): a
  heatmap of cell centroids weighted by Strength at low zoom, a blurred glow fill plus a crisp cell
  fill coloured by Strength tier at high zoom, and every track as a thin, blurred, translucent line
  so overlaps get brighter.
- v1 of the plan used react-native-maps; v2 (when Turf became the main feature) switched.

## 2. Options

- **A. react-native-maps** (Apple Maps / Google Maps)
  - For: the default in Expo examples, native look on each platform.
  - Against: no heatmap layer and no line blur; each polygon is a native object, so thousands of
    cells are slow; Google Maps on Android needs an API key.
  - Fallback shape (PoC risk R1): merge cells into one multipolygon per Strength tier (h3
    `cellsToMultiPolygon`) for a weaker glow that stays performant.
- **B. MapLibre RN + OpenFreeMap** (chosen)
  - For: GPU vector rendering with data-driven styles (heatmap, blur, opacity, zoom interpolation),
    one GeoJSON source for many features, keyless tiles, same renderer on iOS and Android.
  - Against: an extra native dependency with its own build quirks; depends on OpenFreeMap's public
    tile server.

## 3. Decision

Option **B**. Styles are `MAP_STYLE_LIGHT` and `MAP_STYLE_DARK` in `src/constants/map.ts`
(OpenFreeMap `liberty` and `dark`); the Turf Map always uses the dark one
(`src/contexts/territory/ui/turf-map-view.tsx`).

## 4. Consequences

- **iOS build:** Xcode's Swift Package Manager hangs downloading the MapLibre binary on the dev Mac.
  `tools/fetch-maplibre-ios.sh` vendors it into `vendor/maplibre-spm` once, and the config plugin
  `plugins/with-local-maplibre.js` points SPM at that folder (no change when it's absent).
- **Following the user:** the record map uses MapLibre's `onTrackUserLocationChange` (fixed in
  v0.1.0, session log).
- **Not yet verified:** the planned M2 spike on both platforms was never written up as a separate
  record, and MapLibre has not run on Android. The Q4 performance budget is still unmeasured.
- The reference look is `tools/turf-preview.mjs`, an HTML preview of the same layers.
