---
status: canonical
verified: 2026-10-31
owner: founder
scope:
  [
    apps/mobile/src/app/districts.tsx,
    apps/mobile/src/contexts/territory/ui,
    apps/mobile/tools/gen-districts.mjs,
    packages/core/src/contexts/territory,
    packages/core/src/districts,
  ]
summary:
  Plan for the Districts screen, a modal opened from the Turf tab that shows the Home City split
  into its administrative districts (OpenStreetMap boundaries bundled with the app) on a map, with a
  list of districts and the turf area the Turfer holds in each; built in PR 195 (v0.14.0), its
  "Later" section is not
---

# Districts screen (plan)

Status: **built in #195** (`feat/territory-districts`, merged into `scope/v0.14.0` on 2026-10-30,
`ccaa8ea`), slices 1–4. Section 9 ("Later") is not built. The release review then changed, in #205
(`ed620b7`) and #204 (`1607339`):

- `DistrictIndex` keeps its candidates and ring edges in flat typed arrays, and the index and the
  bundled catalogue cache only the last city: about 11 MB → about 1 MB of heap per city (#205's
  measurement);
- `GetDistrictCoverage.execute({ isCurrent })` stops a read whose caller has moved on and rejects it
  with `ReadSuperseded`; the screen's selection state is `districtSelectionReducer`
  (`districts-selection.ts`); `use-districts.test.tsx` renders the hook (#204);
- flow 18 now uses Warsaw (below).

v0.15.0 builds on it in #209 (`e232d90`, merged into `scope/v0.15.0` on 2026-11-01): each row gets a
bar and the district's `share` as a whole percent (`territory/ui/district-share.ts`, "<1%" for a
sliver), read by VoiceOver in the row label, and the Dashboard gets a **Current city** card
(`territory/ui/current-city-card.tsx`: districts with turf out of all, the city's turf, the top
three districts with their share; a tap opens this screen). Flow 18 checks both. Still no lit state:
the §9 decision is open.

## 1. What we are building

A new screen, **Districts**, opened as a modal from the **Turf** tab. It shows the Turfer's Home
City split into its districts:

- **Map on top**: the city's district boundaries drawn over the dark map, the Turfer's turf on top,
  each district shaded by how much turf it holds. Tapping a district selects it.
- **List below**: every district with the turf area the Turfer holds there, in km², and the
  district's own area. Tapping a row selects the district and moves the map to it.

This is the first step towards districts the Turfer has **lit** up (working name, see §9;
feasibility check, 2026-10-29). The coverage number is deliberately simple for now — **km² of turf
cells whose centre lies in the district** — and will be replaced later by a fairer measure (share of
the district's street cells, see §9). No threshold, no "lit" state, no achievement yet.

## 2. User flow

1. Turf tab → new chip **Districts** in the chip row (next to the city chip; shown only when the
   Home City has district data, so Turfers elsewhere never meet "not available yet").
2. The modal slides up (iOS sheet, Android full-screen modal) with the title "Districts" and a close
   button. Swipe down or Close returns to the Turf Map unchanged.
3. The map fits the whole city; the list is sorted by the turf held, most first, then by name.
4. Tap a row or a district on the map → it is highlighted on the map, the camera fits it, the row is
   marked selected. Tap again → back to the whole city.
5. Edge states:
   - **No Home City** (deep link, or it was cleared): a short text and a "Choose your city" button
     that opens the city picker.
   - **City without district data**: "Districts for {city} aren't available yet." with the map still
     showing the city.
   - **No turf in the city yet**: the list still shows every district at 0 km², plus a one-line hint
     to record an activity.
6. Every list row reads well with VoiceOver/TalkBack, units spelled out: "Śródmieście, 0.42 square
   kilometres of turf, district area 5.8 square kilometres". The selected state is announced.

## 3. Data: where district boundaries come from

- **Source**: OpenStreetMap administrative boundaries (`boundary=administrative`), fetched **once at
  development time** by `apps/mobile/tools/gen-districts.mjs` through the Overpass API, like the
  Gdańsk demo routes (`gen-gdansk-routes.mjs`) and the hero city maps. The output is committed. The
  app never calls OpenStreetMap or any other service for districts, so there is no new network
  request, permission or privacy label, and it works offline.
- **Licence**: ODbL. The screen shows "District boundaries © OpenStreetMap contributors".
- **Which boundary is the city**: the `admin_level` boundary (per city, usually 8 in Poland) that
  contains the catalogue centre from `city-catalog.ts`.
- **Which level is a district**: per city in `DISTRICT_CITIES` in the generator, chosen with
  `--probe` (counts per level). Aim: roughly 8–60 districts. Poland mostly uses level 9 (dzielnice,
  osiedla); Berlin level 9 (12 Bezirke). Districts whose interior point lies outside the city
  boundary are dropped (neighbours sharing the border).
- **Processing**: rings assembled from the relation's ways (dangling ends at most 50 m apart are
  bridged by a straight line, only when that closes the relation; Łódź needs one), holes attached to
  their outer ring, outer rings counter-clockwise and holes clockwise (RFC 7946). Simplification
  works on a city's rings together: rings are split into arcs at junctions and each arc is
  simplified once (Douglas–Peucker, 20 m), so neighbours share identical vertices; an arc whose
  result would cross or touch another is redone at a smaller tolerance. Coordinates rounded to 5
  decimals (~1 m), names from the OSM `name` tag (local language, as people know them: "Wrzeszcz
  Górny", not a translation). Every dropped relation is reported with its OSM id and reason.
- **Coverage gate**: the districts must cover 97–103 % of the city's area, or the generator does not
  write the city and exits with an error. Gdańsk and Gdynia are measured against their official land
  area (GUS), because their OSM city boundaries include part of the bay. Each file stores
  `cityAreaM2`, and the data test checks coverage per city.
- **First cities** (generated 2026-10-29, fixed 2026-10-30): Warsaw, Kraków, Łódź (level 10, 57
  osiedla), Wrocław, Poznań, Gdańsk, Szczecin (level 10, 37 osiedla), Bydgoszcz, Lublin, Białystok,
  Katowice, Gdynia, Częstochowa, Rzeszów, Opole and Berlin (12 Bezirke): 16 cities, about 477 KB.
  Toruń (42 % covered in OSM) and Olsztyn (67 %) fail the coverage gate and stay out until OSM is
  complete; Kielce and Sopot have no usable district level; the other catalogue cities are not
  probed yet. Cities without data show no Districts chip.
- **Size budget**: ≤ 60 KB per city and ≤ 600 KB for all district files together (minified JSON, in
  the JS bundle). A test enforces both.
- **Files**: `packages/core/src/districts/data/<city-id>.json` (one per city) and the generated
  `data/index.ts`. Prettier ignores the data folder (generated, like `gdansk-routes.json`).

## 4. Domain and application (packages/core, Territory context)

District is a Territory concept: the turf rules decide what a district holds, so it lives next to
the turf rules and the phone, API and portal can all use it later.

- `domain/district.ts`
  - `District { id, cityId, name, polygons }`, polygons as `[lon, lat]` rings (outer first, then
    holes).
  - Pure functions: `districtAreaM2(d)` (outer minus holes, equirectangular, fine at city scale),
    `districtBounds(d)`, `districtContains(d, point)` (bounding box first, then ray casting; holes
    excluded).
  - `assignToDistricts(districts, points)`: each point goes to at most one district (the first that
    contains it, in catalogue order), so a cell on a shared border is never counted twice.
- `domain/district-catalog.ts`: the port
  `DistrictCatalog { districtsOf(cityId): readonly District[] }` (empty for a city without data).
  Exported from `packages/core/src/contexts/territory/ports.ts`.
- `application/districts.ts`: `GetDistrictCoverage.execute()`
  1. reads the Home City (`HomeCityRepository`); none → `{ status: 'no-city' }`;
  2. reads the city's districts; none → `{ status: 'no-data', city }`;
  3. reads the Turfer's cells inside the districts' bounding box (`repo.cellsIn`, all activity
     types; cell centroids are already stored, so no H3 call);
  4. assigns each cell centroid to a district and sums `grid.areaM2(cell)` and the cell count;
  5. returns `{ status: 'ready', city, bounds, districts: DistrictCoverageView[] }` sorted by
     covered area (desc), then name.
- `contract.ts`:
  `DistrictCoverageView { id, name, areaKm2, coveredKm2, cellCount, share, bounds, polygons }` and
  `DistrictsView` (the union above). `share` = covered / area: map shading, and since #209 the row
  bar and percent and the Dashboard's Current city card.
- `index.ts`: `createTerritoryApi` gets `districts: new GetDistrictCoverage(deps)` and the deps type
  gains `districts: DistrictCatalog`. `createTurfApi` (the API's) is unchanged.
- **Adapter**: new core entry `@cityturfer/core/districts` (`packages/core/src/districts/`)
  exporting `bundledDistricts: DistrictCatalog`, which reads the generated files. Separate entry,
  like `/h3`, so `@cityturfer/core/territory` (the API, the web portal) never loads the data.

## 5. App (apps/mobile)

- `apps/mobile/src/wiring.ts`: pass `districts: bundledDistricts` to `createTerritoryApi`.
- `contexts/territory/ui/hooks.ts`: `useDistricts()` → `DistrictsView | undefined`, re-read on
  `dataVersion` (new activity, deletion) and after a Home City choice, like `useHomeCity`.
- `contexts/territory/ui/districts-view.tsx` (+ `districts-view.constants.ts` for types, sizes and
  layer ids):
  - top ~45% of the screen: MapLibre `Map` (`MAP_STYLE_DARK`), `Camera` fitted to the city (or the
    selected district), `TurfLayers` fed by `useTurfViewport` (the same turf look as the Turf tab),
    a GeoJSON source of districts with a **fill** layer (glow colour, opacity rising with `share`;
    none without turf), a faint neutral fill on the selected district and a **line** layer (border
    colour; the selected one thicker, in the accent). Tapping the map selects the district whose
    boundary holds the tap point.
  - below: a header (city name, total turf in districts) and a `FlatList` of rows (name; covered km²
    in the turf colour, tabular figures; "of {area}" muted). Selected row: accent border.
  - right under the map: the OSM credit with the licence ("© OpenStreetMap contributors (ODbL)"), a
    link to openstreetmap.org/copyright.
  - edge states from §2.
  - Always dark, like the Turf Map (`DARK` palette).
- `apps/mobile/src/app/districts.tsx`: thin route composing `DistrictsView`; "Choose your city" →
  `router.push('/city')`.
- `apps/mobile/src/app/_layout.tsx`:
  `<Stack.Screen name='districts' options={{ presentation: 'modal', headerShown: true, title, headerRight: Close }} />`.
- `contexts/territory/ui/turf-map-view.tsx`: a **Districts** chip (`testID='turf-districts'`) when
  the Home City has district data; new prop `onOpenDistricts`. `(tabs)/turf.tsx` passes
  `router.push('/districts')`.
- Copy: `nav.screens.districts` and `turf.districts.*` in `messages/en` and `messages/pl` (full
  Polish plurals; glossary: "terytorium", "dzielnice").

## 6. Architecture rules this keeps

- Domain stays pure: no h3-js, no React, no data files in `domain/` (the data enters through the
  `DistrictCatalog` port).
- `@cityturfer/core/territory` does not import `packages/core/src/districts` (a dependency-cruiser
  rule `districts-data-only-via-entry` keeps it so).
- No new native module, so the change ships over the air (fingerprint unchanged).
- No coordinates logged; nothing leaves the phone.

## 7. Tests and checks

- **Generator** (`apps/mobile/tools/__tests__/gen-districts.test.mjs`, node test): ring assembly
  (reversed and split ways, the 50 m bridge), holes, winding, shared-arc simplification keeps closed
  rings with at least 4 points and identical shared vertices, interior points, neighbours outside
  the city dropped, unclosed relations reported, the coverage gate and land area, admin-level
  fallback, `index.ts` source.
- **Data** (`packages/core/src/districts/__tests__/data.test.ts`, Jest): every file's city is in the
  catalogue and listed in `DISTRICT_FILES`; ids unique; names non-empty; rings closed with ≥ 4
  points; size budgets from §3; districts of one city don't overlap much (sample points).
- **Domain** (`district.test.ts`): area of a known square, holes subtracted, contains with holes,
  border cells counted once.
- **Use case** (`districts.test.ts`, in-memory repo and catalogue): no city, no data, cells assigned
  and summed, sorting, cells outside every district ignored.
- **App**: `pnpm run typecheck`, lint, `arch`, Jest; `audit:i18n`.
- **E2E**: Maestro flow `18-districts.yaml`: Home City Warsaw (Info › Seed demo history lays its
  turf around the simulator's location, which is Warsaw), seeding the history when the districts
  hold none; a non-zero summary and a covered top row, select and deselect a row, a tap on the map
  centre selects a district, close (since #205; the first version used Gdańsk).
- **Device check** (verify-change): iOS Simulator with the demo account (Gdańsk demo history):
  screenshots in English and Polish, VoiceOver labels, reduce motion (camera jumps, no flight).

## 8. Slices

1. Generator + data for the probed cities, data tests, Prettier ignore.
2. Core: District domain, port, use case, contract, `@cityturfer/core/districts` entry, tests,
   dependency rule.
3. App: wiring, hook, Districts view, route + modal, Turf chip, copy en/pl.
4. Checks: Maestro flow, simulator screenshots, review (`mobile-reviewer`), docs (this plan's
   status, features list).

## 9. Later (not in this version)

- **Fair coverage**: share of the district's street cells (cells the OSM street network passes
  through), generated with the boundaries; the area of a district is mostly buildings, parks and
  water, so area share tops out near 40–50 % even after walking every street (Kraków check,
  2026-10-29).
- **Lit** state (working name) at a threshold (e.g. 60 % of street cells), a celebration in the
  brand's "glow, never casino" voice, district achievements (the existing "District" achievement,
  500 cells, needs a new name first). No military verbs (brand-system's banned words, in Polish
  too); open founder decision: **Lit** (pl "rozświetlona dzielnica") or **Owned** (after "Own your
  streets").
- More cities (probe the rest of the catalogue), district labels on the map, the portal's Districts
  page through the API (`createTurfApi` + the same catalogue).

## 10. Decisions taken for this version

| #   | Decision                                                 | Why                                                            |
| --- | -------------------------------------------------------- | -------------------------------------------------------------- |
| DD1 | Boundaries bundled with the app, generated from OSM      | Offline, no new request or privacy label, same as city catalog |
| DD2 | Coverage = km² of turf cells whose centre is in the area | Asked for now; fairer street measure comes later               |
| DD3 | One admin level per city, set by hand after a probe      | OSM levels differ by country; 8–60 districts reads well        |
| DD4 | Local OSM names, not translated                          | That is how people know their districts                        |
| DD5 | Modal from a Turf tab chip; Home City only               | As asked; other cities come with city switching later          |
