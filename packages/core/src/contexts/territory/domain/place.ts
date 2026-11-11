import { distanceM, type GeoPoint } from '../../../shared-kernel';
import type { City } from './city';
import { assignToDistricts, type District, type LonLat } from './district';
import type { DistrictCatalog } from './district-catalog';

/** Track Points looked at, at most, evenly spread over the track: plenty to find a district. */
export const PLACE_SAMPLE = 300;

/**
 * How far from a city's centre, in its radii, its district boundaries are searched. A city's
 * districts reach up to about 2.5 radii from its centre (Szczecin, Rzeszów, Opole), as the catalogue
 * radius is the built-up core, not the administrative area. Pinned by the bundled-districts data test
 * (packages/core/src/districts/__tests__/data.test.ts).
 */
export const PLACE_SEARCH_RADII = 3;

/** Where an activity happened: a catalogue city and, when the app has its boundaries, a district. */
export interface Place {
  city: City;
  /** Null when the city has no bundled districts. */
  district: District | null;
}

/** At most `max` items, evenly spread from first to last (all of them when there are fewer). */
export function sampleEvenly<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) {
    return [...items];
  }
  if (max <= 1) {
    return max === 1 ? [items[0]] : [];
  }
  const out: T[] = [];
  for (let k = 0; k < max; k++) {
    out.push(items[Math.round((k * (items.length - 1)) / (max - 1))]);
  }
  return out;
}

/**
 * The city and district holding most of the points (a sample of `PLACE_SAMPLE` of them), or null
 * when no point is in a catalogue city. Each point counts for one city at most:
 * - a city with bundled districts holds exactly the points inside its districts (the boundaries are
 *   the real city limits; its catalogue circle is not used);
 * - a city without them holds the points within its catalogue radius of its centre (the nearest
 *   one, relative to its radius, when circles overlap).
 * The city with the most points wins (a tie: the one nearest the track, relative to its radius); its
 * district is the one holding most of the points (a tie: the first in the catalogue's order).
 * Districts are read only for cities near the track, nearest first, and only while points are left
 * unplaced, so a track in one city reads one city's districts.
 */
export function placeOf(points: readonly GeoPoint[], cities: readonly City[], catalog: DistrictCatalog): Place | null {
  const samples = sampleEvenly(points, PLACE_SAMPLE);
  if (samples.length === 0) {
    return null;
  }
  // Each point's distance from each city's centre, in that city's radii, for the cities near the track.
  const near = cities
    .map((city) => {
      const radii = samples.map((p) => distanceM(p, city.center) / city.radiusM);
      return { city, radii, nearest: Math.min(...radii) };
    })
    .filter((c) => c.nearest <= PLACE_SEARCH_RADII)
    .sort((a, b) => a.nearest - b.nearest);

  const cityOf = new Array<number>(samples.length).fill(-1); // index into `near`
  // A city skipped below (no unplaced point within its search radius) keeps []: none of its points
  // reaches the circle pass, so it never matters there whether it has districts.
  const districtsOf: (readonly District[])[] = near.map(() => []);
  const districtOf = new Array<number>(samples.length).fill(-1); // index into districtsOf[cityOf]
  let left = samples.length;
  for (let c = 0; c < near.length && left > 0; c++) {
    const pending = samples.map((_, k) => k).filter((k) => cityOf[k] < 0 && near[c].radii[k] <= PLACE_SEARCH_RADII);
    if (pending.length === 0) {
      continue;
    }
    const districts = catalog.districtsOf(near[c].city.id);
    districtsOf[c] = districts;
    if (districts.length === 0) {
      continue;
    }
    const at = assignToDistricts(
      districts,
      pending.map((k): LonLat => [samples[k].lon, samples[k].lat])
    );
    pending.forEach((k, j) => {
      if (at[j] >= 0) {
        cityOf[k] = c;
        districtOf[k] = at[j];
        left--;
      }
    });
  }
  // Points no district holds: the nearest city without districts whose circle holds them.
  for (let k = 0; k < samples.length; k++) {
    if (cityOf[k] >= 0) {
      continue;
    }
    let best = -1;
    for (let c = 0; c < near.length; c++) {
      const r = near[c].radii[k];
      if (r <= 1 && districtsOf[c].length === 0 && (best < 0 || r < near[best].radii[k])) {
        best = c;
      }
    }
    cityOf[k] = best;
  }

  const votes = new Array<number>(near.length).fill(0);
  cityOf.forEach((c) => c >= 0 && votes[c]++);
  let won = -1;
  votes.forEach((v, c) => {
    if (v > 0 && (won < 0 || v > votes[won])) {
      won = c;
    }
  });
  if (won < 0) {
    return null;
  }
  const districts = districtsOf[won];
  const counts = new Array<number>(districts.length).fill(0);
  cityOf.forEach((c, k) => c === won && districtOf[k] >= 0 && counts[districtOf[k]]++);
  let top = -1;
  counts.forEach((n, i) => {
    if (n > 0 && (top < 0 || n > counts[top])) {
      top = i;
    }
  });
  return { city: near[won].city, district: top >= 0 ? districts[top] : null };
}
