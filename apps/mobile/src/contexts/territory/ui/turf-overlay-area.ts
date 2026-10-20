import { DETAIL_ZOOM } from '@/constants/map';
import type { BoundingBox } from '@/shared-kernel';

import { OVERLAY_MARGIN, type OverlayView } from './turf-overlay-area.constants';

/**
 * The area to load turf for: the view grown by `OVERLAY_MARGIN` of its width and height on every
 * side, so a map that follows the Turfer can move a while before the next read.
 */
export function overlayArea(view: OverlayView): OverlayView {
  const [w, s, e, n] = view.bbox;
  const dx = (e - w) * OVERLAY_MARGIN;
  const dy = (n - s) * OVERLAY_MARGIN;
  return { bbox: [w - dx, s - dy, e + dx, n + dy], zoom: view.zoom };
}

function contains(outer: BoundingBox, inner: BoundingBox): boolean {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}

/**
 * Whether turf loaded for `loaded` (an `overlayArea`) still serves `view`: the view must lie inside
 * it, and stay on the same side of `DETAIL_ZOOM` (hexagons are only loaded when zoomed in).
 */
export function overlayStillCovers(loaded: OverlayView | null, view: OverlayView): boolean {
  if (!loaded) {
    return false;
  }
  const detailed = (z: number) => z >= DETAIL_ZOOM;
  return contains(loaded.bbox, view.bbox) && detailed(loaded.zoom) === detailed(view.zoom);
}
