---
name: turf-territory
description:
  CityTurfer's main feature — turning recorded tracks into "turf" — the Territory bounded context
  (Claim aggregate, Turf Cells on an H3 grid, permanent turf with visit-based Strength, Territory
  projection, rebuild/release), and the Turf Map rendering on MapLibre (heatmap glow,
  strength-coloured cells, overlapping blurred tracks, zoom level-of-detail). Use for anything in
  packages/core/src/contexts/territory/ (domain, use cases, contract), packages/core/src/h3/ or
  apps/mobile/src/contexts/territory/ (SQLite projection, Turf Map UI), the Turf Map screen, "turf
  gained" on activities, tuning turf parameters, or turf performance with large histories.
---

# Turf & Territory

Design source: `docs/poc-plan.md` §2 (the vocabulary), §4.3 (the model) and §5 (map layers).
Reference implementation of the formula and look: `apps/mobile/tools/turf-preview.mjs`.

## Model in one picture

```
ActivityRecorded ─▶ ClaimTurfFromActivity ─▶ Claim (aggregate, immutable)   ter_claims + ter_claim_cells  ← source of truth
                                                │ TurfClaimed
                                                ▼
                                   Territory projection (ter_cells)          ← read model, rebuildable
                                                │ GetTurfInViewport / GetTurfSummary
                                                ▼
                                   Turf Map (MapLibre layers)
```

## Claim: from track to cells (domain, pure)

```ts
static fromTrack(a: ClaimSource, track: Track, grid: CellGrid): Claim {
  const cells = new Set<CellId>();
  for (const seg of track.segments) {               // never bridge segment gaps
    for (let i = 0; i < seg.points.length; i++) {
      cells.add(grid.cellOf(seg.points[i]));
      const next = seg.points[i + 1];
      if (!next) break;
      const steps = Math.ceil(distance(seg.points[i], next).metres / (grid.cellWidthM / 2));
      for (let s = 1; s < steps; s++) cells.add(grid.cellOf(interpolate(seg.points[i], next, s / steps)));
    }
  }
  if (cells.size === 0) throw new DomainError('claim.empty');
  return new Claim({ activityId: a.activityId, type: a.type, claimedAt: a.startedAt, cells });
}
```

- Use the activity's **filtered** Track Points. Never use raw Fixes.
- `claimedAt` is the activity's start time. An imported old activity counts as old turf.
- A `Set` enforces "a cell counts at most once per activity", so running laps of the same block
  doesn't multiply its strength.

## Strength (domain policy, must match the tool exactly)

**Turf is permanent** (product decision, `docs/poc-plan.md` §9): cells never fade or get lost.
Strength depends only on the visit count.

```ts
export const DEFAULT_TURF = { saturationK: 3 } as const;

strength(visits: number, p = DEFAULT_TURF): Strength {
  if (visits < 1) throw new DomainError('turf.no-visits');
  return Strength.of(1 - Math.exp(-visits / p.saturationK));   // k=3: 1→0.28, 3→0.63, 7→0.90, 10→0.96
}
tier(s): s < 0.33 'faint' | < 0.66 'glowing' | < 0.9 'strong' | else 'blazing'
```

- Projection update: applying a Claim increments `visits` (and the type's count) for each cell and
  sets `last_at = max(last_at, claimedAt)`. Order doesn't matter. Releasing a Claim decrements, and
  deletes the cell when it reaches 0.
- Strength is computed on read, so changing `saturationK` needs no migration.
- Test vectors live in `apps/mobile/tools/fixtures/turf-vectors.json` (visits → strength, tier).
  Generate them from the reference formula and assert both the tool and the app against them.
- Don't reintroduce time decay without a product decision. "Recent activity" belongs in the summary
  (new turf this week or month), not in Strength.

## CellGrid port and H3

```ts
export interface CellGrid {
  readonly cellWidthM: number; // ~50 for H3 res 11
  cellOf(p: GeoPoint): CellId;
  boundary(c: CellId): GeoPoint[];
  centroid(c: CellId): GeoPoint;
  parent(c: CellId, res: number): CellId;
  cellsCovering(b: BoundingBox, res: number): CellId[];
  areaM2(c: CellId): number;
}
```

- **Where it lives:** Territory's domain, use cases and contract are in
  `packages/core/src/contexts/territory/` (`@cityturfer/core/territory`; adapters import
  `@cityturfer/core/territory/ports`); the SQLite projection, preferences and Turf Map UI stay in
  `apps/mobile/src/contexts/territory/`. The server will claim turf with the same core code.
- `H3CellGrid` (`packages/core/src/h3/`, entry `@cityturfer/core/h3`) uses h3-js, pinned to one
  exact version in `packages/core/package.json` (guarded by `tools/__tests__/single-h3.test.mjs`):
  `latLngToCell(lat, lng, 11)`, `cellToBoundary`, `cellToParent`, `polygonToCells`,
  `cellArea(c, 'm2')`. Resolution 11 claims; resolution 7 is the parent for viewport indexing
  (`ter_cells.parent_r7`); resolution 9 is the aggregation level when zoomed out.
- The domain never imports h3-js. Tests use `SquareCellGrid` (pure TS, the same as
  `apps/mobile/tools/turf-preview.mjs`).

## Viewport query (application + infrastructure)

`GetTurfInViewport({ bbox, zoom, now, types })`:

1. Expand the bbox by 10%.
2. `SELECT … FROM ter_cells WHERE lat BETWEEN … AND lon BETWEEN …` on the centroid index
   `idx_ter_cells_lat_lon` (filtering by type via the `walk/run/cycle` count columns). (Simpler than
   the parent_r7 index originally planned; revisit if viewport queries exceed budget.)
3. Compute strength from `visits`.
4. At zoom < 14: group by the resolution-9 parent, taking max strength. At zoom ≥ 14: return
   resolution-11 cells.
5. Return GeoJSON-ready DTOs: `{ id, strength, tier, centroid, boundary? }` (boundary only at zoom ≥
   13).

Budget: ≤ 5,000 features per response and < 150 ms on a mid-range Android. Debounce viewport changes
by 250 ms, and cache by `(parent set, zoom bucket, types)`, and invalidate on `TurfClaimed` /
`TurfReleased`.

## Turf Map rendering (ui, MapLibre)

Use `@maplibre/maplibre-react-native` with an OpenFreeMap dark style. Layers, bottom to top:

- `turf-heat`
  - Type: heatmap
  - Source: cell centroids
  - Key style: `heatmap-weight: ['get','strength']`, radius 12→30 px across zoom 8→13, ramp
    transparent → violet → magenta → amber → white. maxzoom 13.5
- `turf-glow`
  - Type: fill
  - Source: cell polygons
  - Key style: colour by tier, `fill-opacity: 0.25 + 0.5*strength`. Render a second blurred line
    layer of the same polygons (`line-blur: 6`, `line-width: 8`) for the halo. minzoom 13
- `turf-cells`
  - Type: fill
  - Source: cell polygons
  - Key style: crisp, `fill-opacity: 0.15 + 0.55*strength`. minzoom 13
- `tracks`
  - Type: line
  - Source: simplified tracks (Douglas–Peucker ε ≈ 5 m)
  - Key style: `line-color` by type, `line-opacity: 0.18`, `line-blur: 1`, width 1.5→3. Overlaps
    brighten naturally

Colours: walk `#5be7a9`, run `#ff8a3d`, cycle `#4cc2ff`. Tier ramp: faint `#7b2ff7`, glowing
`#f72fa8`, strong `#ffb02e`, blazing `#fff3c4`. The Turf Map is always dark, so the glow reads
properly.

Keep sources as `ShapeSource` with stable ids, and update their `shape` rather than remounting
layers. Tracks for the whole history load once (simplified, cached per activity), then get filtered
by type with a layer `filter` expression, not by rebuilding data.

### Camera and the Home City

- The **Home City** (ubiquitous language; UI copy "Your city") is a city from the bundled catalogue
  (`packages/core/src/contexts/territory/domain/city-catalog.ts`) that the maps open on. Stored per
  user as a catalogue id only (`ter_home_city`, migration 7) with a `HomeCityChosen` event (no
  coordinates) in the same transaction; `useHomeCity()` refreshes through `dataVersion`. Picker:
  `apps/mobile/src/app/city.tsx` → `territory/ui/city-picker.tsx`. Decision:
  `docs/decisions/home-city-2026-10-19.md`.
- Turf Map camera: Home City set → `initialViewState.bounds` = the city's bounds (centre ± radius);
  a newly chosen city → `fitBounds`; chip `turf-city` recentres. No Home City → fit all tracks once,
  else follow the user. The Turf and Record screens wait for the Home City before mounting their
  map, and the Camera always mounts with the map: on iOS MapLibre applies `initialViewState` and
  `trackUserLocation` only if the Camera exists at the map's first layout (a Camera added later is
  ignored). A newly chosen city is flown to when the Turf tab is next focused.
- Record map: starts on the Home City centre until the first fix; before a recording starts the
  `record-city` chip opens the picker and a newly chosen city is flown to. The screen hands the city
  in as a `RecordCity` prop (Recording never imports Territory).
- Record map turf overlay (v0.8.0): the "⬡ Turf" chip (`record-turf`, a switch, top right; Recenter
  sits under it) shows the Turfer's turf under the live track, before and during a recording. On by
  default, remembered per user (`territory/infrastructure/turf-overlay-preference.ts`, secure store;
  unset or unreadable = shown). The screen composes it: `useTurfOverlay()` →
  `<TurfLayers beforeId={LIVE_TRACK_BOTTOM_LAYER} look='overlay'>` as `RecordView`'s `mapOverlay`,
  fed by `onViewChange` (both `onRegionIsChanging` and `onRegionDidChange`).
  - **Layer order:** MapLibre adds a layer on top of the style whatever its JSX position, so the
    overlay uses `beforeId`, is mounted after the live track (the `beforeId` layer must exist) and
    stays mounted when hidden (empty cells), and `UserLocation` comes last.
  - **Cost:** turf is loaded for the view grown by half its size on each side
    (`territory/ui/turf-overlay-area.ts`, 4× the area, about 4.8× with the query's own padding:
    larger areas hit `GetTurfInViewport`'s 5000-cell budget and lose their hexagons) and re-read
    only when the view leaves it or crosses `DETAIL_ZOOM`. The view lives in a ref, so following the
    Turfer re-renders nothing; `TurfLayers` is memoised because GeoJSON sources re-serialise their
    data on every render.
  - **Look:** `look='overlay'` (`territory/ui/layers.constants.ts` `TURF_LOOK`) draws lighter fill,
    halo and heatmap than the Turf Map (`'full'`), so streets stay readable under the turf while
    recording.
- Catalogue ids are stored in user databases: never rename or reuse one; a removed id reads as no
  Home City. Adding a city is a JS-only change (ships over the air).

## "Turf gained" UX

After Finish, and on the activity detail: `GetClaimForActivity` → "+0.12 km² new turf · 340 cells
reinforced", plus a mini-map of only that claim's cells (new cells highlighted). Use plain, exact
numbers. Don't invent gamified scores that aren't in the model.

## Tuning workflow

```bash
node apps/mobile/tools/gen-history.mjs --days 120 --out apps/mobile/tools/fixtures/history
node apps/mobile/tools/turf-preview.mjs apps/mobile/tools/fixtures/history --out /tmp/turf.html && open /tmp/turf.html   # sliders: date (watch turf grow), k
```

If you change `saturationK`, change `TurfParameters` in the domain,
`apps/mobile/tools/turf-preview.mjs` and `turf-vectors.json` together.

## Tests that must exist

Claim: no skipped cells on a fast cycle fixture · a cell counted once per activity · no bridging
across a segment gap · empty track rejected. Strength matches the vectors · a cell never disappears
except when every Claim containing it is released. The projection is identical after (a) an in-order
import, (b) a reverse-order import, (c) a delete followed by rebuild. Claiming a 2-hour ride takes <
300 ms. A viewport query over a seeded year stays under the budget.
