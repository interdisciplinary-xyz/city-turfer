import type { ActivityType } from '@cityturfer/core/shared-kernel';

import type { Box, RouteShape } from '../route-shape';

/** A drawing box (viewBox units) and the radius of the start and finish dots in it. */
export type RouteBox = Box & { dot: number };

/** A list row's thumbnail: a square. */
export const ROW_BOX: RouteBox = { width: 64, height: 64, padding: 6, dot: 3 };

/** The detail's shape: wide, as a screen is. */
export const DETAIL_BOX: RouteBox = { width: 640, height: 400, padding: 28, dot: 7 };

/** The brand's per-type CSS variables (`--walk-graphic`, `--ride-text`…): a ride is `cycle` in the API. */
export const TYPE_TOKEN: Record<ActivityType, 'walk' | 'run' | 'ride'> = { walk: 'walk', run: 'run', cycle: 'ride' };

export type RouteSvgProps = {
  shape: RouteShape | null;
  type: ActivityType;
  dot: number;
  /** The text equivalent: given, the shape is an image (`role="img"`); left out, it is decoration next to its text. */
  label?: string;
  className?: string;
};
