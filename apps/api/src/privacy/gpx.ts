import type { ActivityRecord, CompactPoint } from '../backup/model';

/** XML text and attribute escaping. */
const esc = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/**
 * GPX 1.1 of one activity: one `<trk>`, one `<trkseg>` per segment (segments are never bridged),
 * times in UTC. Gap routes are estimates, not recorded points: they stay in data.json only.
 */
export function gpxOf(activity: ActivityRecord, points: readonly CompactPoint[]): string {
  const segments = new Map<number, CompactPoint[]>();
  for (const p of points) {
    const list = segments.get(p[3]) ?? [];
    list.push(p);
    segments.set(p[3], list);
  }
  const trksegs = [...segments.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([, pts]) =>
        `    <trkseg>\n${pts
          .map(
            ([lon, lat, t, , alt]) =>
              `      <trkpt lat="${lat}" lon="${lon}">${alt === null ? '' : `<ele>${alt}</ele>`}<time>${new Date(t).toISOString()}</time></trkpt>`
          )
          .join('\n')}\n    </trkseg>`
    )
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="CityTurfer" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${esc(activity.name)}</name><time>${new Date(activity.startedAt).toISOString()}</time></metadata>`,
    `  <trk>`,
    `    <name>${esc(activity.name)}</name>`,
    `    <type>${activity.type}</type>`,
    trksegs,
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}
