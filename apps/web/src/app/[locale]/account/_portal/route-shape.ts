// The route as an inline SVG shape, no basemap (docs/plans/web-portal-history-2026-10-23.md, H1):
// lon/lat projected with cos(latitude) scaling (so a street grid isn't stretched sideways), fitted
// into a viewBox with its aspect kept, north up. One subpath per recorded segment; the connectors
// between segments (a GPS gap's street estimate when the phone made one, else a straight line, as
// the app draws them) form a separate path, drawn dashed. Longitudes are unwrapped across the
// antimeridian first (`unwrapLines`). Pure: no React, no DOM, no network.
import { simplify } from '@cityturfer/core/shared-kernel';

/** [longitude, latitude] (GeoJSON order, as the API sends them). */
export type Position = readonly [number, number];

/** `[lon, lat, t, segment, altitudeM]`, a point of `GET /v1/activities/{id}/track`. */
export type TrackColumns = readonly [number, number, number, number, number | null];

export type RouteLines = {
  /** The recorded parts, one line per segment, in segment order. */
  segments: Position[][];
  /** The connectors between consecutive segments (estimated along streets, or straight). */
  gaps: Position[][];
};

/** A gap route: `afterSegment` is the index of the segment before the gap in segment order. */
export type GapLine = { afterSegment: number; coords: readonly Position[] };

export type Box = { width: number; height: number; padding: number };

export type RouteShape = {
  width: number;
  height: number;
  /** SVG path data of the recorded segments (one `M…L…` subpath each); '' when none. */
  track: string;
  /** SVG path data of the gap connectors; '' when none. */
  gaps: string;
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
};

/** Metres per degree of latitude (and of longitude at the equator), close enough for a shape. */
const M_PER_DEG = 111_320;

/** The list's preview: one line, as the summary's `preview` comes (already simplified by the API). */
export function previewLines(preview: readonly Position[]): RouteLines {
  return { segments: preview.length > 0 ? [[...preview]] : [], gaps: [] };
}

/**
 * The track's points split by segment, and a connector across each gap between consecutive
 * segments: the phone's street estimate between the two ends, else a straight connector.
 * `afterSegment` is the core's index into the ordered segments (Gap in
 * packages/core/src/contexts/activity-log/domain/gap-route.ts), not the segment number: a track
 * with segments 0, 2, 3 has its gap after segment 2 at index 1 (the app's track-geometry.ts too).
 */
export function trackLines(points: readonly TrackColumns[], gapRoutes: readonly GapLine[] = []): RouteLines {
  const bySegment = new Map<number, Position[]>();
  for (const [lon, lat, , segment] of points) {
    const line = bySegment.get(segment);
    if (line) {
      line.push([lon, lat]);
    } else {
      bySegment.set(segment, [[lon, lat]]);
    }
  }
  const routed = new Map(gapRoutes.map((gap) => [gap.afterSegment, gap.coords]));
  const ordered = [...bySegment.entries()].sort(([a], [b]) => a - b);
  const gaps: Position[][] = [];
  ordered.forEach(([, line], i) => {
    const next = ordered[i + 1];
    if (next) {
      gaps.push([line[line.length - 1], ...(routed.get(i) ?? []), next[1][0]]);
    }
  });
  return { segments: ordered.map(([, line]) => line), gaps };
}

/**
 * Longitudes made continuous across the antimeridian: each is moved by ±360° to within 180° of the
 * route's first point, so a route crossing 180° (Fiji, Chukotka) is one small shape, not a line
 * across the whole world. Lines without a first point come back as they are.
 */
export function unwrapLines(lines: RouteLines): RouteLines {
  const first = lines.segments.find((line) => line.length > 0)?.[0] ?? lines.gaps.find((line) => line.length > 0)?.[0];
  if (!first) {
    return lines;
  }
  const ref = first[0];
  const unwrap = (line: Position[]): Position[] =>
    line.map(([lon, lat]) => {
      let x = lon;
      while (x - ref > 180) {
        x -= 360;
      }
      while (ref - x > 180) {
        x += 360;
      }
      return [x, lat] as const;
    });
  return { segments: lines.segments.map(unwrap), gaps: lines.gaps.map(unwrap) };
}

function extentM(lines: RouteLines): number {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const line of [...lines.segments, ...lines.gaps]) {
    for (const [lon, lat] of line) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  if (!Number.isFinite(minLon)) {
    return 0;
  }
  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  return Math.max((maxLon - minLon) * cos, maxLat - minLat) * M_PER_DEG;
}

/**
 * Fewer points for drawing (core's Douglas–Peucker, render only): a tolerance of about
 * 1/`detail` of the route's extent, which is below a pixel at the size it's drawn.
 */
export function simplifyLines(input: RouteLines, detail = 1500): RouteLines {
  const lines = unwrapLines(input);
  const epsilonM = extentM(lines) / detail;
  if (epsilonM <= 0) {
    return lines;
  }
  const thin = (line: Position[]): Position[] =>
    simplify(
      line.map(([lon, lat]) => ({ lon, lat })),
      epsilonM
    ).map(({ lon, lat }) => [lon, lat] as const);
  return { segments: lines.segments.map(thin), gaps: lines.gaps.map(thin) };
}

const round = (n: number): number => Math.round(n * 10) / 10;

/** The lines fitted into `box` (aspect kept, centred, north up); null when there is nothing to draw. */
export function routeShape(input: RouteLines, { width, height, padding }: Box): RouteShape | null {
  const lines = unwrapLines(input);
  const all = [...lines.segments, ...lines.gaps].flat();
  if (all.length === 0) {
    return null;
  }
  const lats = all.map(([, lat]) => lat);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const xs = all.map(([lon]) => lon * cos);
  const minX = Math.min(...xs);
  const dx = Math.max(...xs) - minX;
  const dy = maxLat - minLat;
  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const scale = dx === 0 && dy === 0 ? 0 : Math.min(dx > 0 ? innerW / dx : Infinity, dy > 0 ? innerH / dy : Infinity);
  const offsetX = (width - dx * scale) / 2;
  const offsetY = (height - dy * scale) / 2;
  const project = ([lon, lat]: Position) => ({
    x: round(offsetX + (lon * cos - minX) * scale),
    y: round(offsetY + (maxLat - lat) * scale),
  });
  const path = (group: Position[][]) =>
    group
      .filter((line) => line.length >= 2)
      .map((line) =>
        line
          .map(project)
          .map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`)
          .join('')
      )
      .join('');
  const first = lines.segments[0]?.[0];
  const lastLine = lines.segments[lines.segments.length - 1];
  const last = lastLine?.[lastLine.length - 1];
  return {
    width,
    height,
    track: path(lines.segments),
    gaps: path(lines.gaps),
    start: first ? project(first) : null,
    end: last ? project(last) : null,
  };
}
