import {
  DEFAULT_HERO_CITY,
  EARTH_RADIUS_M,
  HERO_CITY_IDS,
  type HeroCityId,
  type HeroCityOption,
  NEAR_CITY_MAX_M,
  TIME_ZONE_CITY,
} from './hero-city.constants';

/** The city for a time zone (same rule as CITY_BOOT_SCRIPT); unknown zones get the default. */
export function cityForTimeZone(timeZone: string | undefined): HeroCityId {
  return (timeZone && TIME_ZONE_CITY[timeZone]) || DEFAULT_HERO_CITY;
}

/** A known city id, or null for anything else (e.g. a hand-edited attribute). */
export function asHeroCityId(value: string | null | undefined): HeroCityId | null {
  return (HERO_CITY_IDS as readonly string[]).includes(value ?? '') ? (value as HeroCityId) : null;
}

/**
 * Great-circle distance in metres: the shared kernel's distanceM, repeated here because public pages
 * never load @cityturfer/core (hero-city.test.ts pins both to the same numbers).
 */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The nearest city within NEAR_CITY_MAX_M of the point, or null. Runs on the device only. */
export function nearestCity(point: { lat: number; lon: number }, cities: readonly HeroCityOption[]): HeroCityId | null {
  let best: { id: HeroCityId; m: number } | null = null;
  for (const c of cities) {
    const m = distanceM(point, { lat: c.center[1], lon: c.center[0] });
    if (m <= NEAR_CITY_MAX_M && (!best || m < best.m)) {
      best = { id: c.id, m };
    }
  }
  return best?.id ?? null;
}
