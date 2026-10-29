export interface DistrictsViewProps {
  /** Opens the city picker (the screen owns navigation). */
  onPickCity: () => void;
}

/** The map's share of the screen height; the list of districts takes the rest. */
export const DISTRICT_MAP_HEIGHT = '45%';

/** Room around a city or a district when the camera fits it. */
export const DISTRICT_FIT_PADDING = { top: 28, bottom: 28, left: 28, right: 28 };

/** Fill opacity of a district: a floor so every district shows, rising with the turf it holds. */
export const DISTRICT_FILL = { floor: 0.06, perShare: 1, max: 0.5, selected: 0.5 };

/** The list row's swatch: same idea, brighter, so it reads on a card (no turf: a faint outline only). */
export const DISTRICT_SWATCH = { floor: 0.3, perShare: 4 };
