import { EARTH_RADIUS_M } from '../../../constants/geo';
import type { BoundingBox, GeoPoint } from '../../../shared-kernel';

/**
 * A city the Turfer can choose as their Home City: where the Turf Map opens. Cities come from a
 * catalogue bundled with the app (`city-catalog.ts`): no geocoding, nothing leaves the phone.
 */
export interface City {
  /** Stable catalogue id, e.g. `pl-warsaw`. The only thing stored for the Home City. */
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2, e.g. `PL`. */
  country: string;
  /** The city centre (old town, main square). */
  center: GeoPoint;
  /** Rough radius of the built-up city in metres: how much of it the map shows when it opens. */
  radiusM: number;
}

/**
 * The square around a city's centre, ±radius north–south and east–west (equirectangular; fine at
 * city scale). Map cameras fit it, so the whole city shows whatever the screen size.
 */
export function cityBounds(city: City): BoundingBox {
  const { lat, lon } = city.center;
  const dLat = (city.radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

/** Letters NFD doesn't split into a base letter + accent (Polish ł, Danish ø, German ß…). */
const FOLD: Record<string, string> = { ł: 'l', ø: 'o', ß: 'ss', æ: 'ae', œ: 'oe', đ: 'd' };

/** Lower case, accents removed: "Łódź" → "lodz", "Kraków" → "krakow". */
export function foldForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[łøßæœđ]/g, (c) => FOLD[c] ?? c)
    .trim();
}

/**
 * Other names a city is known by, by city id (e.g. the app's localised "Warszawa" for `pl-warsaw`).
 * Search matches them like the catalogue name; they are never stored.
 */
export type CityAliases = (cityId: string) => readonly string[];

/** How well one name matches a folded query: 0 starts with it, 1 a word starts with it, 2 contains it, -1 no. */
function nameRank(name: string, q: string): number {
  const n = foldForSearch(name);
  if (n.startsWith(q)) {
    return 0;
  }
  if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) {
    return 1;
  }
  return n.includes(q) ? 2 : -1;
}

/**
 * Cities matching a query, accent-insensitive, on the catalogue name and any `aliases`. Names
 * starting with the query come first, then names with a word starting with it, then names containing
 * it (a city ranks by its best-matching name); within each group the catalogue order (biggest cities
 * first) is kept. An empty query returns the whole catalogue.
 */
export function searchCities(catalog: readonly City[], query: string, aliases?: CityAliases): City[] {
  const q = foldForSearch(query);
  if (!q) {
    return [...catalog];
  }
  const namesOf = (c: City): readonly string[] => {
    let extra: readonly string[] = [];
    try {
      extra = aliases?.(c.id) ?? [];
    } catch {
      extra = []; // a failing alias source never breaks the catalogue search
    }
    return [c.name, ...extra];
  };
  const rank = (c: City): number => {
    const ranks = namesOf(c)
      .map((n) => nameRank(n, q))
      .filter((r) => r >= 0);
    return ranks.length > 0 ? Math.min(...ranks) : -1;
  };
  return catalog
    .map((c, i) => ({ c, i, r: rank(c) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}
