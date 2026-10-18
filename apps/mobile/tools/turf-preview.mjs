#!/usr/bin/env node
// Render a folder of GPX activities as a "turf" map: overlapping tracks that
// glow, plus claimed corridor cells whose strength grows with repeat visits.
// Turf is permanent (never fades). Use it to tune the turf parameters (cell
// size, saturation) before/independently of the app.
//
//   node tools/gen-history.mjs --days 120 --out tools/fixtures/history
//   node tools/turf-preview.mjs tools/fixtures/history --out /tmp/turf.html && open /tmp/turf.html
//
// Options:
//   --cell M        grid cell size in metres (default 40 ≈ H3 res 11 hexagon width)
//   --k N           visits for ~63% strength (default 3)     — adjustable in the page
//   --out FILE      output HTML (default turf-preview.html in the current dir)
//
// The grid here is a local square grid (dependency-free). The app uses H3 hexagons, so cell
// counts differ, but the strength formula is the reference (tools/lib/turf.mjs, pinned by
// tools/fixtures/turf-vectors.json; the in-page script below inlines the same formula):
//   strength = 1 − exp(−visits / k)   (one visit per activity per cell; permanent, no decay)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { EARTH_RADIUS_M, haversine, parseGpx } from './lib/geo.mjs';
import { isStrong, strengthOf } from './lib/turf.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const opt = (name, dflt) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt);
if (!dir) {
  console.error('Usage: node tools/turf-preview.mjs <dir-of-gpx> [--cell 40] [--k 3] [--out file.html]');
  process.exit(1);
}
const cellM = Number(opt('cell', 40));
const k = Number(opt('k', 3));
const outFile = opt('out', 'turf-preview.html');

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.gpx'))
  .sort();
if (!files.length) {
  console.error(`No .gpx files in ${dir}`);
  process.exit(1);
}
const activities = files.map((f) => {
  const { type, points } = parseGpx(readFileSync(join(dir, f), 'utf8'));
  return { file: f, type: type ?? 'run', points, t: points[0]?.t ?? 0 };
});

// Local equirectangular grid around the first point.
const origin = activities[0].points[0];
const mPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
const mPerDegLon = mPerDegLat * Math.cos((origin.lat * Math.PI) / 180);
const cellOf = (p) =>
  `${Math.floor(((p.lon - origin.lon) * mPerDegLon) / cellM)},${Math.floor(((p.lat - origin.lat) * mPerDegLat) / cellM)}`;
const boundsOf = (key) => {
  const [x, y] = key.split(',').map(Number);
  return [
    origin.lat + (y * cellM) / mPerDegLat,
    origin.lon + (x * cellM) / mPerDegLon,
    origin.lat + ((y + 1) * cellM) / mPerDegLat,
    origin.lon + ((x + 1) * cellM) / mPerDegLon,
  ];
};

// Claim: every cell the path passes through (densified so no cell is skipped),
// counted once per activity.
const cells = new Map(); // key -> { visits: [dayNumber], types: {walk,run,cycle} }
for (const a of activities) {
  const claimed = new Set();
  for (let i = 0; i < a.points.length; i++) {
    const p = a.points[i];
    claimed.add(cellOf(p));
    const q = a.points[i + 1];
    if (!q) {
      break;
    }
    const steps = Math.ceil(haversine(p, q) / (cellM / 2));
    for (let s = 1; s < steps; s++) {
      claimed.add(cellOf({ lat: p.lat + ((q.lat - p.lat) * s) / steps, lon: p.lon + ((q.lon - p.lon) * s) / steps }));
    }
  }
  const day = Math.floor(a.t / 86400000);
  for (const key of claimed) {
    const c = cells.get(key) ?? { visits: [], types: {} };
    c.visits.push(day);
    c.types[a.type] = (c.types[a.type] ?? 0) + 1;
    cells.set(key, c);
  }
  a.claimed = claimed.size;
}

const data = {
  cellM,
  k,
  firstDay: Math.floor(activities[0].t / 86400000),
  lastDay: Math.floor(activities.at(-1).t / 86400000),
  cells: [...cells].map(([key, c]) => ({ b: boundsOf(key).map((v) => +v.toFixed(6)), v: c.visits })),
  tracks: activities.map((a) => ({
    type: a.type,
    day: Math.floor(a.t / 86400000),
    c: a.points.filter((_, i) => i % 4 === 0).map((p) => [+p.lat.toFixed(5), +p.lon.toFixed(5)]),
  })),
};

const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Turf Preview</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;background:#0b0d12;font:13px system-ui,sans-serif}
  .leaflet-glow-pane{filter:blur(6px) saturate(1.4);mix-blend-mode:screen}
  .leaflet-turf-pane{filter:blur(1px);mix-blend-mode:screen}
  .leaflet-tracks-pane{mix-blend-mode:screen}
  #panel{position:absolute;z-index:1000;top:12px;right:12px;background:#151924ee;color:#e6e9f0;padding:12px 14px;border-radius:10px;width:260px}
  #panel label{display:block;margin:8px 0 2px;color:#9aa3b5}
  #panel input[type=range]{width:100%}
  #stats{margin-top:10px;line-height:1.5}
  .row{display:flex;gap:10px;margin-top:6px}
</style></head><body>
<div id="map"></div>
<div id="panel">
  <b>Turf preview</b>
  <label>As of <span id="dayLbl"></span></label><input id="day" type="range">
  <label>Saturation k = <span id="kLbl"></span> visits</label><input id="k" type="range" min="1" max="10" step="0.5">
  <div class="row"><label><input id="showTracks" type="checkbox" checked> tracks</label><label><input id="showTurf" type="checkbox" checked> turf</label></div>
  <div id="stats"></div>
</div>
<script>
const D = ${JSON.stringify(data)};
const COLORS = { walk: '#5be7a9', run: '#ff8a3d', cycle: '#4cc2ff' };
const map = L.map('map', { preferCanvas: false, zoomControl: false });
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 16 }).addTo(map);
for (const p of ['glow', 'turf', 'tracks']) map.createPane(p);
map.getPane('glow').style.zIndex = 410; map.getPane('turf').style.zIndex = 420; map.getPane('tracks').style.zIndex = 430;
const glow = L.layerGroup().addTo(map), turf = L.layerGroup().addTo(map), tracks = L.layerGroup().addTo(map);
const day = document.getElementById('day'), kk = document.getElementById('k');
day.min = D.firstDay; day.max = D.lastDay; day.value = D.lastDay; kk.value = D.k;
const fmt = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
// strength -> colour ramp (deep violet -> magenta -> amber -> white-hot)
const ramp = (s) => s < 0.33 ? '#7b2ff7' : s < 0.66 ? '#f72fa8' : s < 0.9 ? '#ffb02e' : '#fff3c4';
function render() {
  const now = +day.value, k = +kk.value;
  document.getElementById('dayLbl').textContent = fmt(now);
  document.getElementById('kLbl').textContent = k;
  glow.clearLayers(); turf.clearLayers(); tracks.clearLayers();
  let active = 0, strong = 0, fresh = 0;
  if (document.getElementById('showTurf').checked) for (const c of D.cells) {
    const visits = c.v.filter((d) => d <= now);
    if (!visits.length) continue;                  // not claimed yet at this date
    const s = 1 - Math.exp(-visits.length / k);
    active++; if (s >= 0.66) strong++;
    if (Math.min(...visits) > now - 7) fresh++;    // claimed in the last 7 days
    const b = [[c.b[0], c.b[1]], [c.b[2], c.b[3]]];
    L.rectangle(b, { pane: 'glow', stroke: false, fillColor: ramp(s), fillOpacity: 0.25 + 0.5 * s }).addTo(glow);
    L.rectangle(b, { pane: 'turf', stroke: false, fillColor: ramp(s), fillOpacity: 0.15 + 0.55 * s }).addTo(turf);
  }
  if (document.getElementById('showTracks').checked) for (const t of D.tracks) {
    if (t.day > now) continue;
    L.polyline(t.c, { pane: 'tracks', color: COLORS[t.type], weight: 2, opacity: 0.18 }).addTo(tracks);
  }
  const km2 = (active * D.cellM * D.cellM / 1e6).toFixed(2);
  document.getElementById('stats').innerHTML =
    'Turf: <b>' + km2 + ' km²</b> (' + active + ' cells)<br>Strong: ' + strong + ' · New this week: ' + fresh +
    '<br>Activities so far: ' + D.tracks.filter((t) => t.day <= now).length;
}
for (const el of [day, kk]) el.addEventListener('input', render);
for (const id of ['showTracks', 'showTurf']) document.getElementById(id).addEventListener('change', render);
map.fitBounds(L.latLngBounds(D.tracks.flatMap((t) => t.c)), { padding: [30, 30] });
render();
</script></body></html>`;

writeFileSync(outFile, html);
const strengths = [...cells.values()].map((c) => strengthOf(c.visits.length, k));
const strong = strengths.filter(isStrong).length;
console.log(
  `${activities.length} activities → ${cells.size} cells (${((cells.size * cellM * cellM) / 1e6).toFixed(2)} km² of turf), ${strong} strong`
);
console.log(`Wrote ${outFile} (${(html.length / 1024).toFixed(0)} KB)`);
