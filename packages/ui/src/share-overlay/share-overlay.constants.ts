import type { ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';

/** Where the stats sit: a stack top left (as the reference card) or a row in the bottom third. */
export type ShareOverlayLayout = 'top' | 'bottom';

export type ShareOverlayStat = {
  /** Caption, e.g. "Distance" (drawn uppercase). */
  label: string;
  /** Already formatted, e.g. "5.74", "1:34:44". */
  value: string;
  /** Already formatted, e.g. "km", "/km"; none for a time. */
  unit?: string;
};

export type ShareOverlayProps = {
  /** Width of the card in points; the height is 16:9 of it (a 1080 × 1920 story). */
  width: number;
  layout: ShareOverlayLayout;
  /** The Turfer's photo, cover-cropped and centred; without one the night fill shows. */
  photo?: ImageSourcePropType;
  /** At most three stats, ready-made strings. */
  stats: ShareOverlayStat[];
  /** "+128 new turf cells"; omitted when the line is hidden. */
  turfLine?: string;
  /** The activity's name (drawn uppercase, at most two lines). */
  title: string;
  /** Date and start time, e.g. "9 Nov 2026 · 17:36". */
  when: string;
  /** Optional place line, e.g. "Oliwa, Gdańsk". */
  place?: string;
  /** The night (white) wordmark image. */
  wordmark: ImageSourcePropType;
  /** The activity type's icon at `size` in `color` (the app passes its symbol, Storybook a glyph). */
  renderTypeIcon: (size: number, color: string) => ReactNode;
  /** The photo has loaded (or failed to): the card is ready to capture. */
  onPhotoLoad?: () => void;
  /** What a screen reader says for the whole card (it is one image). */
  accessibilityLabel?: string;
  testID?: string;
};

/** The design canvas: every size below is in units of a 1080 × 1920 story, scaled by width / 1080. */
export const CANVAS = { width: 1080, height: 1920 } as const;

/** Stories UIs cover the top 250 and bottom 300: content stays between these, 72 from the sides. */
export const SAFE = { top: 250, bottom: 1620, side: 72 } as const;

/** Scrim: a plateau at this opacity, then a fade of FADE_BANDS bands of FADE_BAND units each. */
export const SCRIM_OPACITY = 0.6;
export const FADE_BANDS = 12;
export const FADE_BAND = 20;
/** The plateau reaches this far past the text it carries. */
export const SCRIM_MARGIN = 20;

/** Text shadow: the night background at 55 % alpha (`8C` of `FF`), offset 2, radius 12. */
export const SHADOW_ALPHA = '8C';
export const SHADOW = { dy: 2, radius: 12 } as const;

/** Type sizes [font size, line height] and spacing, in canvas units (brand-designer, 2026-11-11). */
export const TYPE = {
  label: [34, 40],
  labelTracking: 2.4,
  value: [120, 120],
  unit: [48, 48],
  bottomLabel: [30, 36],
  bottomValue: [88, 88],
  bottomUnit: [36, 36],
  turf: [44, 48],
  title: [72, 66],
  meta: [34, 42],
} as const;

/** Spacing in canvas units. */
export const GAP = {
  labelToValue: 4,
  valueToUnit: 10,
  betweenStats: 36,
  bottomBetweenStats: 48,
  toTurf: 32,
  bottomToTurf: 28,
  bottomToTitle: 36,
  titleToMeta: 14,
  iconToTitle: 20,
  dotToText: 16,
} as const;

/** Layout top: the stats stack starts here; its scrim plateau reaches at least STATS_PLATEAU_MIN. */
export const STATS_TOP = 280;
export const STATS_PLATEAU_MIN = 920;
/** The bottom block's plateau starts no lower than this (layout top / layout bottom). */
export const BOTTOM_PLATEAU_MAX = { top: 1480, bottom: 1240 } as const;
/** First guess of the bottom block's height before it is measured (one-line title, no place). */
export const BOTTOM_BLOCK_GUESS = { top: 122, bottom: 362 } as const;

export const TITLE_MAX_WIDTH = 708;
export const TITLE_MAX_LINES = 2;
export const ICON_SIZE = 56;
export const TURF_DOT = { size: 22, glow: 14, opacity: 0.9 } as const;
/** Wordmark: 180 × 40, right edge on the side margin, bottom on the last meta line's baseline. */
export const WORDMARK = { width: 180, height: 40, bottom: 1610 } as const;
/** Long values shrink to fit one line, never below this. */
export const MIN_FONT_SCALE = 0.8;
