export interface CurrentCityCardProps {
  /** Opens the Districts screen (the screen owns navigation). */
  onOpenDistricts: () => void;
  /** Opens the city picker. */
  onPickCity: () => void;
}

/** Districts listed on the card: the ones holding the most turf. */
export const CITY_CARD_TOP = 3;

/** The card's bars (districts lit, each listed district's share) and the width of a share's text. */
export const CITY_CARD_BAR = { city: 6, district: 4, minPct: 2, percentWidth: 36 };
