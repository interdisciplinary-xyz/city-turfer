/** How turf is drawn on every map (the Turf Map and the Record map look the same). */
export const TURF_STYLE = {
  /** Hexagon fill opacity: `base + scale × strength`. */
  fillBase: 0.18,
  fillScale: 0.55,
  /** Blurred halo around each hexagon. */
  haloWidth: 10,
  haloOpacity: 0.7,
  /** Heatmap opacity at city zoom (it fades out towards `DETAIL_ZOOM + 1`). */
  heatOpacity: 0.95,
} as const;
