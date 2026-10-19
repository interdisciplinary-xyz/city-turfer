export type CityPickerProps = {
  /** Called after a city was chosen or the choice cleared (the screen goes back). */
  onDone: () => void;
};

/** Country names for the catalogue's ISO codes, as shown under each city. */
export const COUNTRY_NAME: Record<string, string> = {
  PL: 'Poland',
  DE: 'Germany',
  GB: 'United Kingdom',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  AT: 'Austria',
  CZ: 'Czechia',
  HU: 'Hungary',
  NL: 'Netherlands',
  DK: 'Denmark',
  SE: 'Sweden',
  LT: 'Lithuania',
  IE: 'Ireland',
  PT: 'Portugal',
};
