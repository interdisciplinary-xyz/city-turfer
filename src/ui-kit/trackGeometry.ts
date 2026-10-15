import type { TrackPoint } from '@/shared-kernel';

/**
 * Map geometry for a track: one `kind: 'track'` line per Segment, plus a
 * `kind: 'gap'` connector between consecutive segments so the whole route
 * reads as one line. Gaps are drawn only — never measured or claimed.
 */
export function trackWithGaps(track: readonly TrackPoint[]): GeoJSON.FeatureCollection {
  const bySeg = new globalThis.Map<number, [number, number][]>();
  for (const p of track) {
    const line = bySeg.get(p.segment) ?? [];
    line.push([p.lon, p.lat]);
    bySeg.set(p.segment, line);
  }
  const segments = [...bySeg.entries()].sort(([a], [b]) => a - b).map(([, coords]) => coords);
  const features: GeoJSON.Feature[] = [];
  segments.forEach((coords, i) => {
    if (coords.length > 1) {
      features.push({
        type: 'Feature',
        properties: { kind: 'track' },
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
    const next = segments[i + 1];
    if (next) {
      features.push({
        type: 'Feature',
        properties: { kind: 'gap' },
        geometry: { type: 'LineString', coordinates: [coords[coords.length - 1], next[0]] },
      });
    }
  });
  return { type: 'FeatureCollection', features };
}
