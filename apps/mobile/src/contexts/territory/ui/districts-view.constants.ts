import { SPACE } from '@cityturfer/brand';

import type { DistrictCoverageView } from '../contract';

export interface DistrictsViewProps {
  /** Opens the city picker (the screen owns navigation). */
  onPickCity: () => void;
}

export interface DistrictRowProps {
  district: DistrictCoverageView;
  selected: boolean;
  /** Stable across renders: the row passes its own id. */
  onToggle: (id: string) => void;
  /** Fixed, so the list can jump to any row (`getItemLayout`). */
  height: number;
}

/** The map's share of the screen height; the list of districts takes the rest. */
export const DISTRICT_MAP_HEIGHT = '45%';

/** Room around a city or a district when the camera fits it. */
export const DISTRICT_FIT_PADDING = { top: 28, bottom: 28, left: 28, right: 28 };

/** Camera move to a district or back to the city (0 with Reduce Motion). */
export const DISTRICT_FIT_MS = 500;

/**
 * Fill of a district on the map, in the turf colour, only where it holds turf (the ramp means
 * turf): from a floor, rising with the share it covers. No turf: no fill; the outline shows the
 * shape.
 */
export const DISTRICT_FILL = { floor: 0.1, perShare: 1, max: 0.5 };

/** The selected district: a faint neutral lift (never more turf colour) under its accent outline. */
export const DISTRICT_SELECTED_FILL = 0.08;

/** Outline widths: the selected district's accent outline reads 5.5:1 on the dark map at 3. */
export const DISTRICT_LINE = { width: 1.2, selectedWidth: 3 };

export const DISTRICT_LINE_LAYOUT = { 'line-join': 'round' } as const;

/** One empty list, so the map's memoised layers keep their data when there are no districts. */
export const NO_DISTRICTS: DistrictCoverageView[] = [];

/** Layer ids; the turf goes between the fills and the outline (`beforeId`). */
export const DISTRICT_LAYER = {
  source: 'districts',
  fill: 'districts-fill',
  selected: 'districts-selected',
  line: 'districts-line',
} as const;

/**
 * The list row's swatch. With turf: the solid glow colour from an opacity floor of 0.6, so it reads
 * on a card. No turf: an outline in the control border colour, no fill.
 */
export const DISTRICT_SWATCH = { size: 12, radius: 3, floor: 0.6, perShare: 4 };

/**
 * A row's fixed height: padding and border plus two lines of the name, which grow with the text
 * size. The border keeps its width when selected (only its colour changes), so nothing shifts.
 */
export const DISTRICT_ROW = {
  border: 2,
  paddingVertical: SPACE.sm,
  /** Line height of the name at text scale 1; the row holds two lines. */
  nameLine: 20,
  /** Space under each row (part of its slot in `getItemLayout`). */
  gap: SPACE.sm,
};

/** Spacing between the header's lines (city name, summary). */
export const DISTRICT_HEADER_GAP = SPACE.xxs;

/** Where the credit links to: OpenStreetMap's copyright and licence page (ODbL). */
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/** Extra touch area around the one-line credit, to reach 44 pt. */
export const CREDIT_HIT_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };
