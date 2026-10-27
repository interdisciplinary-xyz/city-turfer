import type { MapPoint } from './hero-screens.constants';

/**
 * An SVG path through the points as a smooth curve (Catmull-Rom turned into cubic Béziers), so a
 * route bends like a street rather than snapping at each corner.
 */
export function smoothPath(points: readonly MapPoint[], tension = 0.5): string {
  if (points.length < 3) {
    return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  }
  const k = tension / 3;
  const parts = [`M${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = p2[1] - (p3[1] - p1[1]) * k;
    parts.push(`C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${p2[0]} ${p2[1]}`);
  }
  return parts.join(' ');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
