import { DEFAULT_HERO_CITY, type HeroCityId, TIME_ZONE_CITY } from './hero-city.constants';

/** The city for a time zone (same rule as CITY_BOOT_SCRIPT); unknown zones get the default. */
export function cityForTimeZone(timeZone: string | undefined): HeroCityId {
  return (timeZone && TIME_ZONE_CITY[timeZone]) || DEFAULT_HERO_CITY;
}
