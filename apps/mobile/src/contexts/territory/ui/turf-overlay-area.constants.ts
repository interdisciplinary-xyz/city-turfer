import type { BoundingBox } from '@/shared-kernel';

/** What a map shows: its bounds ([west, south, east, north]) and zoom. */
export type OverlayView = { bbox: BoundingBox; zoom: number };

/**
 * Turf is loaded for the view plus this share of its width and height on each side (2× each way,
 * 4× the area; about 4.8× once `GetTurfInViewport` adds its own 10% padding). Larger areas risk its
 * 5000-cell budget for dense histories, and above it hexagons give way to coarse centroids.
 */
export const OVERLAY_MARGIN = 0.5;
