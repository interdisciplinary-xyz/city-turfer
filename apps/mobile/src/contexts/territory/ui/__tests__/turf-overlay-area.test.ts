import { DETAIL_ZOOM } from '@/constants/map';

import { overlayArea, overlayStillCovers } from '../turf-overlay-area';

const view = { bbox: [21.0, 52.2, 21.01, 52.21] as const, zoom: 16 };

describe('overlayArea', () => {
  it('grows the view by half its width and height on every side (4× the area)', () => {
    const a = overlayArea(view);
    expect(a.bbox[0]).toBeCloseTo(20.995);
    expect(a.bbox[1]).toBeCloseTo(52.195);
    expect(a.bbox[2]).toBeCloseTo(21.015);
    expect(a.bbox[3]).toBeCloseTo(52.215);
    expect(a.zoom).toBe(16);
  });
});

describe('overlayStillCovers', () => {
  const loaded = overlayArea(view);

  it('needs a first load', () => {
    expect(overlayStillCovers(null, view)).toBe(false);
  });

  it('keeps the loaded turf while the view moves inside the loaded area', () => {
    const moved = { bbox: [21.003, 52.203, 21.013, 52.213] as const, zoom: 16.4 };
    expect(overlayStillCovers(loaded, moved)).toBe(true);
  });

  it('reloads once the view leaves the loaded area', () => {
    const away = { bbox: [21.015, 52.2, 21.025, 52.21] as const, zoom: 16 };
    expect(overlayStillCovers(loaded, away)).toBe(false);
  });

  it('reloads when zooming across the hexagon threshold', () => {
    expect(overlayStillCovers(loaded, { ...view, zoom: DETAIL_ZOOM - 0.5 })).toBe(false);
    const coarse = overlayArea({ ...view, zoom: DETAIL_ZOOM - 1 });
    expect(overlayStillCovers(coarse, { ...view, zoom: DETAIL_ZOOM - 0.2 })).toBe(true);
    expect(overlayStillCovers(coarse, { ...view, zoom: DETAIL_ZOOM })).toBe(false);
  });

  it('reloads when zooming out past the loaded area', () => {
    const wide = { bbox: [20.97, 52.17, 21.04, 52.24] as const, zoom: 14 };
    expect(overlayStillCovers(loaded, wide)).toBe(false);
  });
});
