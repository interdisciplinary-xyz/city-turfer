// Builds the landing page's street-glow demo (docs/plans/homepage-sections-2026-10-28.md, section 3)
// from the Gdańsk demo history, with the app's own rules: cells from @cityturfer/core/h3 (H3 res 11)
// and tiers from the territory domain's strength formula. Writes plain numbers to
// src/app/[locale]/turf-demo/turf-demo.data.json, so the page never loads core or h3-js.
//
//   pnpm --filter @cityturfer/web run turf-demo           write the data file
//   pnpm --filter @cityturfer/web run turf-demo -- --check exit 1 if the committed file is stale
//
// Runs under tsx (core is TypeScript source). Deterministic: a fixed "today" for the demo plan.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { evaluateAchievements } from '@cityturfer/core/achievements';
import { GDANSK_ROUTES, planGdanskDemo, pointsOf } from '@cityturfer/core/demo';
import { H3CellGrid } from '@cityturfer/core/h3';
import { strengthOf, tierOf } from '@cityturfer/core/territory';

const OUT = path.resolve(import.meta.dirname, '../src/app/[locale]/turf-demo/turf-demo.data.json');
const TODAY = Date.UTC(2026, 9, 28);
const TIERS = ['faint', 'glowing', 'strong', 'blazing'];
const VIEW = { width: 800, height: 1000, pad: 40 };
/** Cells in the one street of beat 1. */
const STREET_CELLS = 9;
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON_EQ = 111_320;

const round = (n) => Math.round(n * 10) / 10;

/** Equirectangular projection fitted into the view box around a bounding box in metres. */
function projector(points, { width, height, pad }, lat0) {
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const toM = (p) => ({ x: p.lon * cos * M_PER_DEG_LON_EQ, y: -p.lat * M_PER_DEG_LAT });
  const ms = points.map(toM);
  const minX = Math.min(...ms.map((m) => m.x));
  const maxX = Math.max(...ms.map((m) => m.x));
  const minY = Math.min(...ms.map((m) => m.y));
  const maxY = Math.max(...ms.map((m) => m.y));
  const scale = Math.min((width - 2 * pad) / (maxX - minX), (height - 2 * pad) / (maxY - minY));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  return {
    scale,
    project: (p) => {
      const m = toM(p);
      return [round((m.x - minX) * scale + offX), round((m.y - minY) * scale + offY)];
    },
  };
}

export function buildTurfDemo() {
  const grid = new H3CellGrid();
  const plan = planGdanskDemo(TODAY);

  // Visits per cell: each activity counts a cell once, as a Claim does. Claim.fromTrack also adds
  // cells between fixes more than half a cell apart; the demo's fixes are at most ~16 m apart (3 s at
  // ride speed) against a ~21.6 m step (cellWidthM / 2), so the raw fixes give the same cells (the worst case
  // is ~17 m plus noise; the margin is thin, so the caption's cell count may sit a few below the app's).
  const visits = new Map();
  for (const activity of plan) {
    for (const cell of new Set(pointsOf(activity).map((p) => grid.cellOf(p)))) {
      visits.set(cell, (visits.get(cell) ?? 0) + 1);
    }
  }
  const tierOfVisits = (v) => tierOf(strengthOf(v));

  // The fewest visits that reach each tier, straight from the formula.
  const visitsPerTier = {};
  for (let v = 1; Object.keys(visitsPerTier).length < TIERS.length; v++) {
    visitsPerTier[tierOfVisits(v)] ??= v;
  }

  // Beat 2: the whole city, cell centres per tier.
  const cells = [...visits.keys()];
  const lat0 = cells.reduce((s, c) => s + grid.centroid(c).lat, 0) / cells.length;
  const city = projector(
    cells.map((c) => grid.centroid(c)),
    VIEW,
    lat0
  );
  const cityByTier = Object.fromEntries(TIERS.map((t) => [t, []]));
  let areaM2 = 0;
  for (const cell of cells.sort()) {
    cityByTier[tierOfVisits(visits.get(cell))].push(...city.project(grid.centroid(cell)).map(Math.round));
    areaM2 += grid.areaM2(cell);
  }
  const edgeM = grid.cellWidthM / Math.sqrt(3);

  // Beat 1: the most-repeated stretch of the favourite route (the Main Town loop).
  const route = GDANSK_ROUTES[0];
  const ordered = [];
  for (let i = 0; i < route.path.length - 1; i++) {
    const [aLat, aLon] = route.path[i];
    const [bLat, bLon] = route.path[i + 1];
    for (let s = 0; s < 8; s++) {
      const cell = grid.cellOf({ lat: aLat + ((bLat - aLat) * s) / 8, lon: aLon + ((bLon - aLon) * s) / 8 });
      if (ordered.at(-1) !== cell && visits.has(cell)) {
        ordered.push(cell);
      }
    }
  }
  let best = { score: -1, start: 0 };
  for (let i = 0; i + STREET_CELLS <= ordered.length; i++) {
    const window = ordered.slice(i, i + STREET_CELLS);
    if (new Set(window).size < STREET_CELLS) {
      continue;
    }
    const counts = window.map((c) => visits.get(c));
    const score = Math.min(...counts) * 1000 + counts.reduce((a, b) => a + b, 0);
    if (score > best.score) {
      best = { score, start: i };
    }
  }
  const streetCells = ordered.slice(best.start, best.start + STREET_CELLS);
  const streetPoints = streetCells.flatMap((c) => grid.boundary(c));
  const street = projector(streetPoints, { ...VIEW, pad: 150 }, lat0);
  const inView = ([x, y]) => x > -60 && x < VIEW.width + 60 && y > -60 && y < VIEW.height + 60;
  const polygon = (cell) => grid.boundary(cell).flatMap((p) => street.project(p));
  const streetSet = new Set(streetCells);
  const context = cells.filter((c) => !streetSet.has(c) && inView(street.project(grid.centroid(c))));
  const lines = [];
  for (const r of GDANSK_ROUTES) {
    let line = [];
    for (const [lat, lon] of r.path) {
      const xy = street.project({ lat, lon });
      if (inView(xy)) {
        line.push(...xy);
      } else if (line.length) {
        lines.push(line);
        line = [];
      }
    }
    if (line.length > 2) {
      lines.push(line);
    }
  }

  return {
    view: { width: VIEW.width, height: VIEW.height },
    visitsPerTier,
    street: {
      cells: streetCells.map(polygon),
      context: context.sort().map(polygon),
      lines: lines.filter((l) => l.length > 2),
    },
    city: { radius: round(edgeM * city.scale * 1.1), ...cityByTier },
    achievements: evaluateAchievements({ activities: [], turfCells: 0, strongCells: 0 }).length,
    totals: {
      activities: plan.length,
      cells: cells.length,
      areaKm2: Math.round(areaM2 / 10_000) / 100,
    },
  };
}

/** One line of JSON: kept out of Prettier (.prettierignore) so --check compares bytes. */
export function renderDataFile(demo) {
  return `${JSON.stringify(demo)}\n`;
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const text = renderDataFile(buildTurfDemo());
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(OUT, 'utf8');
    } catch {
      // missing counts as stale
    }
    if (current !== text) {
      console.error(`${path.relative(process.cwd(), OUT)} is stale: run pnpm --filter @cityturfer/web run turf-demo`);
      process.exit(1);
    }
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${path.relative(process.cwd(), OUT)} (${text.length} bytes)`);
  }
}
