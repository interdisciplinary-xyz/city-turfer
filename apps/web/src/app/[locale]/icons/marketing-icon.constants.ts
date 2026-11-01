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
  'infinity',
  'check',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** One shape: stroked by default; `filled` for the few solid points (the mark's "you are here"). */
export type IconShape = { d: string; filled?: true };

/** A circle as path data, so every shape is a `<path>`. */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export const ICON_PATHS: Record<IconName, readonly IconShape[]> = {
  /** A walker in profile, upright, short stride. */
  walk: [
    { d: circle(13, 4.5, 1.75) },
    { d: 'M12.6 8.5 11.2 14' },
    { d: 'M11.2 14l2 3.3.4 3.7' },
    { d: 'M11.2 14l-1.6 3.5L7.8 21' },
    { d: 'M12.4 9.5 9.8 11.4 9.3 14' },
    { d: 'M12.4 9.5l2.3 1.9 2 .9' },
  ],
  /** A runner leaning forward, long stride. */
  run: [
    { d: circle(15.5, 4.25, 1.75) },
    { d: 'M14 8 11 13.5' },
    { d: 'M11 13.5l3.6 1.8-.9 5.2' },
    { d: 'M11 13.5l-2 3.7-4 .3' },
    { d: 'M13.7 8.7l2.6 2.3 2.7-.8' },
    { d: 'M13.7 8.7 10.4 9.8 8.6 12.3' },
  ],
  /** A bicycle: two wheels, frame, saddle and bars. */
  ride: [
    { d: circle(5.5, 16.5, 3.5) },
    { d: circle(18.5, 16.5, 3.5) },
    { d: 'M5.5 16.5 9 10.5l2.5 6H5.5' },
    { d: 'M9 10.5h7l-4.5 6' },
    { d: 'M18.5 16.5 15.6 8.5h2.4' },
    { d: 'M7.5 8.5h3' },
  ],
  /** The mark in one line: a turf cell with the street-wave and its "you are here" point. */
  cell: [
    { d: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9Z' },
    { d: 'M6.6 15.4C9.2 15.9 9.4 12 12 12S14.9 8.5 16.2 8.9' },
    { d: circle(16.2, 8.9, 1.7), filled: true },
  ],
  /** The app's Record button: a ring around a solid dot. */
  record: [{ d: circle(12, 12, 8.5) }, { d: circle(12, 12, 3.75), filled: true }],
  /** Apple Health: a heart. */
  health: [
    {
      d: 'M12 19.8C6.6 16.4 3.6 13.2 3.6 9.6A4.3 4.3 0 0 1 8 5.2c1.7 0 3.1.9 4 2.4.9-1.5 2.3-2.4 4-2.4a4.3 4.3 0 0 1 4.4 4.4c0 3.6-3 6.8-8.4 10.2Z',
    },
  ],
  /** An achievement: a medal on a ribbon, a star at its heart. */
  badge: [
    { d: circle(12, 9, 5.75) },
    { d: 'M8.4 13.5 7.5 21l4.5-2.4 4.5 2.4-.9-7.5' },
    { d: 'M12 6.3l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z', filled: true },
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
  /** Two arrows chasing each other round: repeats count. */
  repeat: [
    { d: 'M4.5 12a7.5 7.5 0 0 1 14-3.75' },
    { d: 'M18.5 4v4.25h-4.25' },
    { d: 'M19.5 12a7.5 7.5 0 0 1-14 3.75' },
    { d: 'M5.5 20v-4.25h4.25' },
  ],
  /** Infinity: nothing fades. */
  infinity: [
    {
      d: 'M12 12c-1.9-2.4-3.5-3.6-5.2-3.6a3.6 3.6 0 0 0 0 7.2c1.7 0 3.3-1.2 5.2-3.6Zm0 0c1.9 2.4 3.5 3.6 5.2 3.6a3.6 3.6 0 0 0 0-7.2c-1.7 0-3.3 1.2-5.2 3.6Z',
    },
  ],
  /** A tick: works today. */
  check: [{ d: 'M4.5 12.5l4.75 4.75L19.5 7' }],
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

/** How it differs (home.differs.<key>) → icon; the section has none today. */
export const ICON_FOR_DIFFER = { repeats: 'repeat', fades: 'infinity', private: 'lock' } as const satisfies Record<
  string,
  IconName
>;

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
