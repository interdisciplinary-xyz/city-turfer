---
status: proposed
verified: 2026-10-28
owner: founder
scope: ['apps/web/src/app/[locale]', apps/web/src/app/globals.css, apps/web/tools, apps/web/public]
summary:
  Plan for a street map of the visitor's city behind the landing-page hero, drawn at build time from
  OpenStreetMap and chosen in the browser from the time zone (opt-in precise pick later), with no
  cookies, no API calls and no third-party requests
---

# City map behind the hero (plan)

Status: **built, not shipped** (2026-10-28, uncommitted on `scope/v0.14.0`), waiting for the
founder's and the brand-designer's look; open questions were answered with the defaults under
"Decisions taken". Rules: the `web-motion` skill (static export, privacy, en/pl, stories),
`brand-system` and `brand-surfaces`. Owners: `web-engineer` (build), `brand-designer` (look and
contrast sign-off).

## Goal

A visitor opening the landing page sees the streets of **their own city** faintly behind the hero,
as if the app's Turf Map were waiting for them. It should say "this is about where you live" without
a word of copy, and without breaking the public pages' promise: **no cookies, no API calls, no
third-party scripts or requests** (`docs/decisions/web-portal-2026-10-22.md`).

**Out of scope:** live map tiles or MapLibre on the landing page, IP lookups (our own or a
service's), server code or middleware (the site stays `output: 'export'`), asking for location on
page load, the portal and `/branding`.

## What "detect the city" can mean here

| Signal                                   | Accuracy               | Cost                                  | Use      |
| ---------------------------------------- | ---------------------- | ------------------------------------- | -------- |
| Time zone (`Intl…resolvedOptions()`)     | country (one per zone) | none: read in the browser, never sent | **v1**   |
| Page language (`/en`, `/pl`)             | weak tie-breaker       | none                                  | **v1**   |
| Browser geolocation, after a click       | street-level           | permission prompt, opt-in             | **v2**   |
| IP via Vercel headers or a lookup server | city-level, often off  | server code, personal data, no export | rejected |
| Live tiles (OpenFreeMap) for any place   | any city               | third-party requests, heavy script    | rejected |

So v1 shows the **most likely** city for the visitor's country (Polish time zone → a Polish city),
and v2 adds a small opt-in "Show my city" that picks the nearest prepared city **on the device**.
Honest framing for copy and reviews: v1 is a good guess, not detection.

## How it works

### 1. Maps drawn at build time (committed assets)

- New dev tool `apps/web/tools/gen-city-maps.mjs`, modelled on
  `apps/mobile/tools/gen-gdansk-routes.mjs`: for each city in a committed list, query OpenStreetMap
  **once** (Overpass API, a 6.4 × 4.8 km box around the centre: `highway` motorway…residential,
  living streets and pedestrian; footways, cycleways and service roads left out for size;
  `natural=water`, riverbanks, rivers and canals), project to a 1600 × 1200 canvas (4 m per px),
  clip, simplify (Douglas–Peucker, 1 px), round to whole pixels, and write
  `apps/web/public/city-maps/<id>-streets.svg` and `<id>-water.svg`. Output is committed; the build
  and the browser never call OpenStreetMap. `--cache <dir>` keeps the raw answers for re-tuning.
- The SVGs carry **no colour**: streets and water are plain black shapes used as CSS **masks**, so
  every colour comes from the brand's CSS variables (no hex in generated files, `audit:brand` stays
  green). Two layers per city: `<slug>-streets.svg` and `<slug>-water.svg`.
- Size budget: ≤ 80 KB gzipped per city (checked by a test). Thin residential streets go first if a
  city goes over.
- Cities come from the app's Home City catalogue, `CITY_CATALOG` in
  `packages/core/src/contexts/territory/domain/city-catalog.ts` (23 Polish, 15 European, centres on
  the old town; `apps/web` already depends on `@cityturfer/core`). Map files use the catalogue id
  (`pl-gdansk-streets.svg`), so the hero and the app's Home City always name the same place.
  `apps/web/src/app/[locale]/hero-city/hero-city.constants.ts` only lists which ids get a map and
  which time zones point to each: Gdańsk (default), Warsaw, Kraków, Wrocław, Poznań, plus Berlin,
  London, Prague, Vilnius for the nearest foreign zones. Each visitor downloads one city.

### 2. Choosing the city before first paint

- A tiny inline script (`CITY_BOOT_SCRIPT`) right after the map element reads the time zone, maps it
  to a city id and sets `data-city` on the `.hero-city` element, before the first paint. Not on
  `<html>`: the `web-motion` skill keeps `<html>` for the motion class only, so
  `suppressHydrationWarning` sits on `.hero-city` alone. No storage, no network. Language is not
  used: every Polish zone already maps to one city.
- CSS picks the masks per city: `.hero-city[data-city='pl-warsaw'] { --city-streets: url(...) }`.
  Only the matching files download; without JavaScript the default (Gdańsk) shows. No flash, no
  layout shift: the layer is `position: absolute; inset: 0; z-index: -1` inside `.hero` (which has
  `isolation: isolate`).

### 3. The look

- `HeroCity` component inside `.hero` (now rendered by `HeroMotion`), `aria-hidden`. Streets in
  `--muted` at low opacity, water a step lighter than `--bg`, a radial vignette into `--bg` so the
  text area and the edges stay flat dark. The map must not lower the hero text's WCAG contrast (AA
  measured against the brightest map pixel under the text).
- Motion (with `gsap.matchMedia`, `prefers-reduced-motion: no-preference` only): the map fades in
  once after the headline and drifts a few pixels with the pointer on desktop, reusing the hero's
  existing `tilt` query. Reduced motion: static, no fade.
- Optional (decide after v1 is seen): 2–3 short streets near the centre glow in the turf Ramp, so
  the background hints at turf. Off in v1.
- Brand sign-off needed: `docs/plans/web-scroll-motion-2026-10-25.md` keeps the page "flat dark on
  purpose"; this is a deliberate, faint exception for the hero only.

### 4. Attribution (required)

OpenStreetMap data is ODbL: show "© OpenStreetMap contributors" (linked to
`https://www.openstreetmap.org/copyright`, a plain link, not a script) in small `--muted` text at
the end of the city line under the hero. Keys under `hero.map` in `apps/web/messages/en.json` and
`pl.json`; `audit:i18n` checks both.

### 5. v2: "Show my city" (opt-in)

- One line under the hero (`HeroCityLine`): "Streets of [city ▾] · Near me · © OpenStreetMap
  contributors". The select lists the prepared cities.
- "Near me" calls `navigator.geolocation.getCurrentPosition` once, picks the nearest city centre in
  the browser (`distanceM` from the shared kernel), swaps `data-city`, and throws the coordinates
  away. Nothing is stored or sent. If the visitor is far from every city (> 50 km), keep the guess
  and say so.
- Remembering the choice is **not** in v2 (would need storage on a public page; see open questions).

## Files

| File                                                                           | What                                 |
| ------------------------------------------------------------------------------ | ------------------------------------ |
| `apps/web/tools/gen-city-maps.mjs` (+ `__tests__/gen-city-maps.test.mjs`)      | generator, geometry tests            |
| `apps/web/public/city-maps/`                                                   | committed masks, two per city        |
| `apps/web/src/app/[locale]/hero-city/hero-city.constants.ts`                   | city ids, time zones, boot script    |
| `apps/web/src/app/[locale]/hero-city/pick-city.ts`                             | time zone → city, nearest city       |
| `apps/web/src/app/[locale]/hero-city/city-options.ts`                          | centres from the catalogue (server)  |
| `apps/web/src/app/[locale]/hero-city/hero-city.tsx`, `.css`                    | map layer and the city line          |
| `apps/web/src/app/[locale]/hero-city/hero-map-picker.tsx`                      | client: select, Near me, credit      |
| `apps/web/src/app/[locale]/hero-city/hero-city.test.ts`                        | rules, files, budget, copy           |
| `apps/web/src/app/[locale]/page.tsx`                                           | `HeroMotion` is the `.hero` now      |
| `apps/web/src/app/[locale]/hero-motion/hero-motion.tsx`                        | map fade-in and pointer drift        |
| `apps/web/messages/en.json`, `pl.json`                                         | `hero.map.*`                         |
| `apps/web/e2e/landing.spec.ts`                                                 | time zones, one city loaded, Near me |
| `apps/storybook/src/stories/website/hero-city.stories.tsx`, `hero.stories.tsx` | stories                              |

## Acceptance criteria

1. With a Polish time zone the hero shows a Polish city; with `Europe/London`, London; with an
   unknown zone or JavaScript off, Gdańsk. Playwright covers this with `timezoneId`.
2. The landing page makes **no** request outside its own origin and sets no cookie or storage
   (Playwright request log; `check-export.mjs`; the CSP is unchanged).
3. Only one city's files download per visit.
4. No layout shift from the map (CLS unchanged), LCP not worse by more than 100 ms on a mid phone
   profile; each city ≤ 80 KB gzipped.
5. Hero text keeps WCAG AA contrast over the map at 390 px and 1440 px.
6. Reduced motion: no fade or drift. Screen readers ignore the map; the credit link is reachable.
7. OSM credit visible in both languages; `audit:i18n`, `audit:brand` and `ci:quality` pass.
8. v2: location is asked only after the click, never stored or sent; denying it leaves the guess.

## Decisions taken (defaults, change freely)

1. **Polish time zone → Gdańsk**, the demo city the phones already show. Other Polish cities through
   the select or "Near me".
2. **City list:** five Polish cities plus Berlin, London, Prague and Vilnius.
3. **No remembered choice:** nothing is stored; a reload goes back to the time-zone guess.
4. **Streets only**, no turf glow on the background map.

## Still to do

- Brand-designer look and contrast check (acceptance 5) and a real-browser look at the motion.
- Lighthouse comparison for LCP/CLS (acceptance 4).
- The phones' Turf Map prototype still shows Warsaw district names over a Gdańsk background.
