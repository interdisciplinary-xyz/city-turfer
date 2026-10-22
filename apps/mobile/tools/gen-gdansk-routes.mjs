#!/usr/bin/env node
// Build the street-following routes behind the Gdańsk demo account (dev only).
// Each favourite route is a loop of hand-picked waypoints in Gdańsk, sent once
// to the FOSSGIS OpenStreetMap router so the demo tracks follow real streets,
// paths and the seaside bike lane. The result is committed, so the app never
// calls the router for demo data.
//
//   node tools/gen-gdansk-routes.mjs            # writes src/dev/gdansk-routes.json
//
// Waypoints are public places (squares, parks, the beach), not anyone's home.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/dev/gdansk-routes.json', import.meta.url));
const BASE = 'https://routing.openstreetmap.de';
const PROJECT_URL = 'https://github.com/interdisciplinary-xyz/city-turfer';
const PROFILE = { walk: 'routed-foot', run: 'routed-foot', cycle: 'routed-bike' };

/** [lon, lat] waypoints; every route starts and ends at its first point. */
const ROUTES = [
  {
    name: 'Main Town loop',
    type: 'walk',
    via: [
      [18.6466, 54.3489], // Golden Gate, Długa
      [18.6555, 54.3486], // Green Gate
      [18.658, 54.351], // Crane on the Motława
      [18.656, 54.353],
      [18.6505, 54.353],
    ],
  },
  {
    name: 'Granary Island',
    type: 'walk',
    via: [
      [18.6555, 54.3486],
      [18.66, 54.347],
      [18.664, 54.35],
      [18.662, 54.3525],
      [18.6585, 54.3515],
    ],
  },
  {
    name: 'Oliwa Park',
    type: 'walk',
    via: [
      [18.558, 54.409],
      [18.563, 54.4115],
      [18.566, 54.4085],
      [18.561, 54.407],
    ],
  },
  {
    name: 'Old Town and the Shipyard',
    type: 'walk',
    via: [
      [18.6466, 54.3489],
      [18.648, 54.3555],
      [18.6505, 54.36],
      [18.644, 54.362],
      [18.642, 54.355],
    ],
  },
  {
    name: 'Motława and Biskupia Górka',
    type: 'run',
    via: [
      [18.6466, 54.3489],
      [18.66, 54.347],
      [18.665, 54.344],
      [18.65, 54.342],
      [18.642, 54.344],
    ],
  },
  {
    name: 'Wrzeszcz and Jaśkowa Dolina',
    type: 'run',
    via: [
      [18.605, 54.38],
      [18.596, 54.376],
      [18.588, 54.379],
      [18.595, 54.385],
    ],
  },
  {
    name: 'Brzeźno beach',
    type: 'run',
    via: [
      [18.6283, 54.41],
      [18.615, 54.417],
      [18.6, 54.418],
      [18.608, 54.41],
    ],
  },
  {
    name: 'Seaside bike path',
    type: 'cycle',
    via: [
      [18.6466, 54.3489],
      [18.605, 54.38],
      [18.596, 54.429], // Jelitkowo
      [18.6283, 54.4105], // Brzeźno pier
      [18.6435, 54.3895], // Letnica (not Nowy Port: it snaps to the ferry)
    ],
  },
  {
    name: 'Oliwa, Przymorze and Zaspa',
    type: 'cycle',
    via: [
      [18.605, 54.38],
      [18.562, 54.41],
      [18.595, 54.41],
      [18.6, 54.395],
    ],
  },
];

const round = (n) => Math.round(n * 1e5) / 1e5;

async function route(r) {
  const pts = [...r.via, r.via[0]].map(([lon, lat]) => `${lon},${lat}`).join(';');
  const url = `${BASE}/${PROFILE[r.type]}/route/v1/driving/${pts}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { 'User-Agent': `CityTurfer-dev (+${PROJECT_URL})`, Referer: PROJECT_URL } });
  if (!res.ok) {
    throw new Error(`${r.name}: router ${res.status}`);
  }
  const body = await res.json();
  if (body.code !== 'Ok') {
    throw new Error(`${r.name}: ${body.code}`);
  }
  const best = body.routes[0];
  return {
    name: r.name,
    type: r.type,
    distanceM: Math.round(best.distance),
    path: best.geometry.coordinates.map(([lon, lat]) => [round(lat), round(lon)]),
  };
}

const out = [];
for (const r of ROUTES) {
  const built = await route(r);
  console.log(`${built.type.padEnd(5)} ${(built.distanceM / 1000).toFixed(1).padStart(5)} km  ${built.name}`);
  out.push(built);
  await new Promise((ok) => setTimeout(ok, 1100)); // public router: at most one request a second
}
writeFileSync(OUT, `${JSON.stringify({ city: 'pl-gdansk', routes: out })}\n`);
console.log(`wrote ${OUT}`);
