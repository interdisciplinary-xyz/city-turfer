/** What the Districts screen remembers between taps: the selected district and the list's jump. */
export interface DistrictSelection {
  /** The selected district's id; null: the whole city. */
  selected: string | null;
  /**
   * The row the list should bring into view (a district picked on the map), or null. A new object
   * per request, so picking the same district again after scrolling away jumps again.
   */
  scrollTo: { index: number } | null;
}

export type DistrictSelectionAction =
  /** A row tapped: select it, or go back to the city if it was selected. The row is on screen. */
  | { type: 'toggle-row'; id: string }
  /** A district tapped on the map: as a row tap, and its row (in `districts`) comes into view. */
  | { type: 'tap-map'; id: string; districts: readonly { id: string }[] };

export const NO_DISTRICT_SELECTED: DistrictSelection = { selected: null, scrollTo: null };
