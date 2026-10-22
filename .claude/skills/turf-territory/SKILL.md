---
name: turf-territory
description: >-
  Use for turf: Claims, H3 Turf Cells, Strength, the Territory projection, viewport queries, Turf
  Map and Record-map turf layers, Home City, "turf gained", turf tuning or performance. Code:
  packages/core/src/contexts/territory/, packages/core/src/h3/, apps/mobile/src/contexts/territory/.
---

# Turf & Territory

Design source: `docs/poc-plan.md` §2 (the vocabulary), §4.3 (the model) and §5 (map layers).
Reference implementation of the formula: `apps/mobile/tools/lib/turf.mjs` (used by
`apps/mobile/tools/turf-preview.mjs` for the look and tuning).

**Where it lives:** Territory's domain, use cases and contract are in
`packages/core/src/contexts/territory/` (`@cityturfer/core/territory`; adapters import
`@cityturfer/core/territory/ports`). The SQLite projection (`SqliteTerritoryRepository`,
`SqliteHomeCityRepository`), the overlay preference and the Turf Map UI stay in
`apps/mobile/src/contexts/territory/`. The server will claim turf with the same core code.

## Model in one picture

```
ActivityRecorded ─▶ ClaimTurfFromActivity ─▶ Claim (aggregate, immutable)   ter_claims + ter_claim_cells  ← source of truth
                                                │ TurfClaimed
                                                ▼
                                   Territory projection (ter_cells)          ← read model, rebuildable
                                                │ GetTurfInViewport / GetTurfSummary / GetClaimForActivity
                                                ▼
                                   Turf Map + Record map (MapLibre layers)
ActivityDeleted ─▶ ReleaseTurfOfActivity (the only way turf shrinks)
ActivityTrackCorrected ─▶ ReclaimTurfOfActivity (release + claim again)
```

## Claim: from track to cells (`domain/claim.ts`, pure)

```ts
static fromTrack(src: { activityId; type; startedAt }, track: Track, grid: CellGrid, now: number): Claim {
  if (src.startedAt > now + 60_000) throw new DomainError('claim.in-future');
  const cells = new Set<CellId>();
  const step = grid.cellWidthM / 2;
  for (const seg of track.segments) {               // a segment is TrackPoint[]; never bridge gaps
    for (let i = 0; i < seg.length; i++) {
      cells.add(grid.cellOf(seg[i]));
      const next = seg[i + 1];
      if (!next) break;
      const n = Math.ceil(distanceM(seg[i], next) / step);
      for (let s = 1; s < n; s++) cells.add(grid.cellOf(interpolate(seg[i], next, s / n)));
    }
  }
  if (cells.size === 0) throw new DomainError('claim.empty');
  return new Claim({ activityId: src.activityId, type: src.type, claimedAt: src.startedAt, cells });
}
```

- Use the activity's **filtered** Track Points. Never use raw Fixes.
- `claimedAt` is the activity's start time. An imported old activity counts as old turf.
- A `Set` enforces "a cell counts at most once per activity", so running laps of the same block
  doesn't multiply its strength.
- `claim.claimed(newCells, grid, now)` records `TurfClaimed` (cell count, new cells, new area) once
  the projection has said which cells were new.

## Strength (`domain/strength.ts`, must match the tool exactly)

**Turf is permanent** (product decision, `docs/poc-plan.md` §9): cells never fade or get lost.
Strength depends only on the visit count.

```ts
export const TURF_SATURATION_K = 3;

strengthOf(visits, k = TURF_SATURATION_K) // throws DomainError('turf.no-visits') when visits < 1
  = 1 - Math.exp(-visits / k);            // k=3: 1→0.28, 3→0.63, 7→0.90, 10→0.96
tierOf(s): s < 0.33 'faint' | < 0.66 'glowing' | < 0.9 'strong' | else 'blazing'
isStrong(s): tier is 'strong' or 'blazing'
```

- Projection update: applying a Claim increments `visits` (and the type's count) for each cell and
  sets `last_at = max(last_at, claimedAt)`. Order doesn't matter. Releasing a Claim decrements, and
  deletes the cell when it reaches 0.
- Strength is computed on read, so changing `TURF_SATURATION_K` needs no migration.
- Test vectors live in `apps/mobile/tools/fixtures/turf-vectors.json` (visits → strength, tier); the
  core territory test and `apps/mobile/tools/__tests__/turf-parity.test.mjs` both assert against
  them.
- Don't reintroduce time decay without a product decision. "Recent activity" belongs in the summary
  (new turf this week or month), not in Strength.

## CellGrid port and H3

```ts
export interface CellGrid {
  readonly cellWidthM: number; // ~50 for H3 res 11
  cellOf(p: GeoPoint): CellId;
  centroid(c: CellId): GeoPoint;
  boundary(c: CellId): GeoPoint[];
  areaM2(c: CellId): number;
  coarse(c: CellId): CellId; // coarser cell containing c, for zoomed-out aggregation
}
```

- `H3CellGrid` (`packages/core/src/h3/`, entry `@cityturfer/core/h3`) uses h3-js, pinned to one
  exact version in `packages/core/package.json` (guarded by `tools/__tests__/single-h3.test.mjs`):
  `latLngToCell(lat, lon, 11)`, `cellToLatLng`, `cellToBoundary`, `cellArea(c, 'm2')`, and
  `cellToParent(c, 9)` for `coarse`. Resolution 11 claims; resolution 9 aggregates.
- The domain never imports h3-js (core's `h3-only-in-h3` dependency rule). Tests use the real
  `H3CellGrid` (`packages/core/src/contexts/territory/domain/__tests__/territory.test.ts`); a
  pure-TS square grid like the one in `turf-preview.mjs` is an option if H3 ever gets in the way.

## Viewport query (`GetTurfInViewport`, core application + app repository)

`execute(bbox, zoom, types = ACTIVITY_TYPES): Promise<TurfCellView[]>`:

1. Expand the bbox by 10% on each axis.
2. `repo.cellsIn(bbox, types)`: `SELECT … FROM ter_cells WHERE lat BETWEEN … AND lon BETWEEN …` on
   the centroid index `idx_ter_cells_lat_lon`; visits are summed over the selected types' count
   columns and cells with 0 drop out.
3. Compute strength and tier from those visits.
4. Up to `MAX_FEATURES` (5,000) cells: return them all; each carries a `ring` (closed polygon,
   `[lon, lat]`) only when `zoom >= DETAIL_ZOOM` (13.5, `packages/core/src/constants/turf.ts`). More
   than 5,000: aggregate to the coarse (res 9) cell, keeping the strongest member, no rings.
5. DTO (`contract.ts` `TurfCellView`): `{ id, strength, tier, visits, centroid, ring? }`.

Budget: < 150 ms on a mid-range Android. The UI hook `useTurfViewport` debounces view changes by 250
ms and re-reads when `dataVersion` changes (after any commit). A cache by
`(parent set, zoom bucket, types)` is planned if queries exceed budget (likewise a `parent_r7` index
column).

## Turf Map rendering (ui, MapLibre)

`@maplibre/maplibre-react-native` with the OpenFreeMap dark style (`MAP_STYLE_DARK`,
`apps/mobile/src/constants/map.ts`). `TurfLayers`
(`apps/mobile/src/contexts/territory/ui/layers.tsx`) draws, bottom to top:

- `turf-heat` (heatmap) on `GeoJSONSource` `turf-points` (cell centroids): weight from `strength`,
  radius and intensity interpolated over zoom 8 → 14, colour ramp transparent → faint → glowing →
  strong → blazing (`TIER_COLOR`), fading out up to `maxzoom` `DETAIL_ZOOM + 1`.
- `turf-halo` (line, `line-blur: 8`, width and opacity from `TURF_STYLE`) and `turf-fill` (fill,
  `fill-opacity: fillBase + fillScale × strength`) on `GeoJSONSource` `turf-cells` (the rings), both
  `minzoom` `DETAIL_ZOOM`, coloured by tier.

`TurfMapView` (`turf-map-view.tsx`) adds `turf-tracks-line` on `GeoJSONSource` `turf-tracks`: every
Activity's stored `preview` (Douglas–Peucker ε = 15 m), coloured by type (`TYPE_COLOR`), low opacity
and a slight blur so overlaps brighten, filtered by type with a layer `filter` expression rather
than by rebuilding data. `ClaimLayers` draws one claim (`claim-fill`, new cells in the glowing
colour).

Colours come only from `@cityturfer/brand` via `apps/mobile/src/constants/colors.ts`:
`TYPE_COLOR.walk|run|cycle` for tracks, `TIER_COLOR.faint|glowing|strong|blazing` for turf. Never
hard-code hex. Tunables live in `TURF_STYLE` (`ui/layers.constants.ts`). The Turf Map is always
dark, so the glow reads properly.

Keep sources mounted with stable ids and pass new `data` rather than remounting layers; memoise the
GeoJSON (sources re-serialise their data on every render).

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
  `<TurfLayers beforeId={LIVE_TRACK_BOTTOM_LAYER}>` as `RecordView`'s `mapOverlay`, fed by
  `onViewChange` (both `onRegionIsChanging` and `onRegionDidChange`).
  - **Layer order:** MapLibre adds a layer on top of the style whatever its JSX position, so the
    overlay uses `beforeId`, is mounted after the live track (the `beforeId` layer must exist) and
    stays mounted when hidden (empty cells), and `UserLocation` comes last.
  - **Cost:** turf is loaded for the view grown by half its size on each side
    (`territory/ui/turf-overlay-area.ts`, 4× the area, about 4.8× with the query's own padding:
    larger areas hit `GetTurfInViewport`'s 5000-cell budget and lose their hexagons) and re-read
    only when the view leaves it or crosses `DETAIL_ZOOM`. The view lives in a ref, so following the
    Turfer re-renders nothing; `TurfLayers` is memoised because GeoJSON sources re-serialise their
    data on every render.
  - **Look:** the Record map uses the Turf Map's dark style and the same turf look
    (`territory/ui/layers.constants.ts` `TURF_STYLE`), so turf looks the same on both maps.
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

If you change `TURF_SATURATION_K` or the tier bounds, change
`packages/core/src/contexts/territory/domain/strength.ts`, `apps/mobile/tools/lib/turf.mjs` and
`apps/mobile/tools/fixtures/turf-vectors.json` together.

## Tests that must exist

Claim: no skipped cells on a fast cycle fixture · a cell counted once per activity · no bridging
across a segment gap · empty track rejected. Strength matches the vectors · a cell never disappears
except when every Claim containing it is released. The projection is identical after (a) an in-order
import, (b) a reverse-order import, (c) a delete followed by rebuild. Claiming a 2-hour ride takes <
300 ms. A viewport query over a seeded year stays under the budget.
