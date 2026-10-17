// Dependency-free geo helpers shared by the dev tools.
// These are the *reference* implementations: src/metrics/ in the app should
// produce the same numbers (within rounding) for the same input.

export const EARTH_RADIUS_M = 6371008.8;

export const PROFILES = {
  // speeds in m/s; maxSpeed is the outlier-rejection ceiling, movingSpeed the auto-pause floor,
  // minStep the jitter filter (metres) — keep in sync with src/tracking/profiles.ts
  walk: { speed: 1.4, speedJitter: 0.2, maxSpeed: 4, movingSpeed: 0.5, minStep: 3, elevHysteresis: 3 },
  run: { speed: 3.0, speedJitter: 0.4, maxSpeed: 8, movingSpeed: 1.0, minStep: 4, elevHysteresis: 3 },
  cycle: { speed: 6.5, speedJitter: 1.5, maxSpeed: 25, movingSpeed: 1.5, minStep: 6, elevHysteresis: 5 },
};

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Move `distM` metres from `p` along `bearingDeg`.
export function destination(p, bearingDeg, distM) {
  const d = distM / EARTH_RADIUS_M;
  const br = toRad(bearingDeg);
  const lat1 = toRad(p.lat);
  const lon1 = toRad(p.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lon2 =
    lon1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lon: toDeg(lon2) };
}

export function bearing(a, b) {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Deterministic PRNG so fixtures are reproducible.
export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// --- GPX ---------------------------------------------------------------

export function toGpx(points, { name = 'TurfTrack route', type } = {}) {
  const trkpts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">` +
        (p.ele != null ? `<ele>${p.ele.toFixed(1)}</ele>` : '') +
        `<time>${new Date(p.t).toISOString()}</time></trkpt>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TurfTrack tools" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>${type ? `\n    <type>${type}</type>` : ''}
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function parseGpx(xml) {
  const type = xml.match(/<type>([^<]+)<\/type>/)?.[1]?.trim();
  const points = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = m[1] ?? m[3];
    const body = m[2] ?? '';
    const lat = Number(attrs.match(/lat="([^"]+)"/)?.[1]);
    const lon = Number(attrs.match(/lon="([^"]+)"/)?.[1]);
    const ele = body.match(/<ele>([^<]+)<\/ele>/)?.[1];
    const time = body.match(/<time>([^<]+)<\/time>/)?.[1];
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ lat, lon, ele: ele != null ? Number(ele) : undefined, t: time ? Date.parse(time) : undefined });
    }
  }
  return { type, points };
}
