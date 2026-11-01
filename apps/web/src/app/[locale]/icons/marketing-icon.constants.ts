/**
 * The marketing pages' outline icons, in the mark's stroke style: a 24 × 24 grid, round caps and
 * joins, one stroke width, drawn in `currentColor` so the caller picks the colour through a token
 * (`--accent-text`, `--walk-text`…). No colour lives here: a test fails on any hex.
 * The files are not called icon.*: under app/, Next.js serves icon.tsx as the favicon route.
 */

/** The grid every path is drawn on. */
export const ICON_GRID = 24;

/** Stroke width on the 24 grid (about 1.5 px at 20 px, 2.3 px at 32 px). */
export const ICON_STROKE = 1.75;

export const ICON_NAMES = [
  'walk',
  'run',
  'ride',
  'cell',
  'record',
  'health',
  'badge',
  'pin',
  'phone',
  'lock',
  'repeat',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** One shape: stroked by default; `filled` for the few solid points (the mark's "you are here"). */
export type IconShape = { d: string; filled?: true };

/** A circle as path data, so every shape is a `<path>`. */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export const ICON_PATHS: Record<IconName, readonly IconShape[]> = {
  /** A walker in profile, upright, short stride; drawn 2–22 tall so it weighs as much as ride. */
  walk: [
    { d: circle(12.8, 3.9, 1.95) },
    { d: 'M12.4 8.3 10.8 14.3' },
    { d: 'M10.8 14.3 13 18l.5 4' },
    { d: 'M10.8 14.3 9.1 18.2 7.1 22' },
    { d: 'M12.2 9.4 9.7 11.3 9.1 12.8' },
    { d: 'M12.2 9.4l2.5 2.1 2.2 1' },
  ],
  /** A runner leaning forward, long stride; same optical size as walk. */
  run: [
    { d: circle(15.9, 3.9, 1.95) },
    { d: 'M14.2 8.1 10.9 14.2' },
    { d: 'M10.9 14.2l4 2-1 5.8' },
    { d: 'M10.9 14.2l-2.3 4.2-4.4.3' },
    { d: 'M13.9 8.9l2.9 2.5 3-.9' },
    { d: 'M13.9 8.9 10.2 10.1 8.2 12.9' },
  ],
  /** A bicycle: two wheels, frame, saddle on its seat tube, bars; inside 3–21. */
  ride: [
    { d: circle(6.15, 14, 3.15) },
    { d: circle(17.85, 14, 3.15) },
    { d: 'M6.15 14h5.4L8.6 6.8' },
    { d: 'M6.15 14 9.3 8.6h6.3L11.55 14' },
    { d: 'M17.85 14 15.25 6.8h2.15' },
    { d: 'M7.4 6.8h2.5' },
  ],
  /**
   * The mark in one line, its own geometry × 24/1024 (packages/brand/svg/mark.svg): the turf cell,
   * the street-wave from the lower-left edge to the upper-right one, and the "you are here" point on its crest.
   */
  cell: [
    { d: 'M12 4.3l6.7 3.85v7.7L12 19.7l-6.7-3.85v-7.7Z' },
    { d: 'M5.9 17C8.9 17 9.2 13.1 12 12S15 7.3 18.2 7' },
    { d: circle(18.2, 7, 1.4), filled: true },
  ],
  /** The app's Record button: a ring around a solid dot. */
  record: [{ d: circle(12, 12, 8.5) }, { d: circle(12, 12, 3.75), filled: true }],
  /** Apple Health: a heart. */
  health: [
    {
      d: 'M12 19.8C6.6 16.4 3.6 13.2 3.6 9.6A4.3 4.3 0 0 1 8 5.2c1.7 0 3.1.9 4 2.4.9-1.5 2.3-2.4 4-2.4a4.3 4.3 0 0 1 4.4 4.4c0 3.6-3 6.8-8.4 10.2Z',
    },
  ],
  /** An achievement: a medal on a ribbon, a big star filling it (not record's dot, even at 20 px). */
  badge: [
    { d: circle(12, 8.5, 5) },
    { d: 'M8.8 12.3 7.6 21l4.4-2.4 4.4 2.4-1.2-8.7' },
    {
      d: 'M12 5.3l.85 2.23 2.38.12-1.85 1.5.62 2.3-2-1.3-2 1.3.62-2.3-1.85-1.5 2.38-.12Z',
      filled: true,
    },
  ],
  /** A map pin: your home city. */
  pin: [{ d: 'M12 21.2s-6.8-6.1-6.8-11.4a6.8 6.8 0 0 1 13.6 0c0 5.3-6.8 11.4-6.8 11.4Z' }, { d: circle(12, 9.8, 2.4) }],
  /** A phone: where the original stays. */
  phone: [
    {
      d: 'M9.2 2.5h5.6A2.2 2.2 0 0 1 17 4.7v14.6a2.2 2.2 0 0 1-2.2 2.2H9.2A2.2 2.2 0 0 1 7 19.3V4.7a2.2 2.2 0 0 1 2.2-2.2Z',
    },
    { d: 'M11 18.4h2' },
  ],
  /** A padlock: private by default. */
  lock: [
    { d: 'M7 10.5h10a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z' },
    { d: 'M8 10.5V7.5a4 4 0 0 1 8 0v3' },
    { d: 'M12 14.6v2.3' },
  ],
  /** Coming back: one loop that leaves a point and returns to it, arrow first (not the two-arrow sync glyph). */
  repeat: [
    { d: circle(5.4, 18.6, 1.4), filled: true },
    { d: 'M7.22 18.04 15.42 15.53A6.2 6.2 0 1 0 7.53 8.34L6.33 14.1' },
    { d: 'M8.46 12.13 6.33 14.1 5.16 11.44' },
  ],
};

/** Every emoji or glyph the marketing pages draw today, and the icon that replaces it. */
export const ICON_FOR_GLYPH = {
  '🚶': 'walk',
  '🏃': 'run',
  '🚴': 'ride',
  '⬢': 'cell',
  '●': 'record',
  '♥': 'health',
  '★': 'badge',
  '◎': 'pin',
  '📱': 'phone',
} as const satisfies Record<string, IconName>;

/** Activity type (as code names it: `cycle`) → icon (as the UI names it: Ride). */
export const ICON_FOR_TYPE = { walk: 'walk', run: 'run', cycle: 'ride' } as const satisfies Record<string, IconName>;

/** Highlights tiles (home.highlights.<key>) → icon. */
export const ICON_FOR_HIGHLIGHT = {
  gain: 'cell',
  record: 'record',
  health: 'health',
  achievements: 'badge',
  city: 'pin',
} as const satisfies Record<string, IconName>;

/** Disc tints: the caller's colour token, mixed this much into the surface behind it. */
export const ICON_DISC_TINT = 0.12;

export type IconProps = {
  name: IconName;
  /** Rendered width and height in px (default 24). */
  size?: number;
  /** Set only when the icon carries meaning on its own; without it the icon is hidden from assistive tech. */
  title?: string;
  className?: string;
};
