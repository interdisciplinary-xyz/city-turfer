/**
 * How strongly turf is drawn. `full` is the Turf Map, where turf is the subject. `overlay` is the
 * Record map, where the streets and the live track matter more: lighter fill and glow, so street
 * lines stay readable through the hexagons.
 */
export type TurfLook = 'full' | 'overlay';

export type TurfLookStyle = {
  /** Hexagon fill opacity: `base + scale × strength`. */
  fillBase: number;
  fillScale: number;
  /** Blurred halo around each hexagon. */
  haloWidth: number;
  haloOpacity: number;
  /** Heatmap opacity at city zoom (it fades out towards `DETAIL_ZOOM + 1` either way). */
  heatOpacity: number;
};

export const TURF_LOOK: Record<TurfLook, TurfLookStyle> = {
  full: { fillBase: 0.18, fillScale: 0.55, haloWidth: 10, haloOpacity: 0.7, heatOpacity: 0.95 },
  overlay: { fillBase: 0.06, fillScale: 0.22, haloWidth: 5, haloOpacity: 0.3, heatOpacity: 0.6 },
};
