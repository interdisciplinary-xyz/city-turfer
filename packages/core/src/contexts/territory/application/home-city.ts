import type { Clock } from '../../../shared-kernel';
import type { CityView, HomeCityChosen } from '../contract';
import { type City, cityBounds, searchCities } from '../domain/city';
import { CITY_CATALOG, cityById, homeCityFromCatalogue } from '../domain/city-catalog';
import type { HomeCityRepository } from '../domain/home-city-repository';

export interface HomeCityDeps {
  homeCities: HomeCityRepository;
  clock: Clock;
  afterCommit: () => void;
}

export function toCityView(c: City): CityView {
  const [w, s, e, n] = cityBounds(c);
  return { id: c.id, name: c.name, country: c.country, center: [c.center.lon, c.center.lat], bounds: [w, s, e, n] };
}

/**
 * The catalogue city with this id, as a view (servers answer it for a stored Home City).
 * Throws DomainError `home-city.unknown` when the id is not in the catalogue.
 */
export function catalogueCityView(id: string): CityView {
  return toCityView(homeCityFromCatalogue(id));
}

/** The user's Home City, or null. An id no longer in the catalogue reads as null. */
export class GetHomeCity {
  constructor(private readonly d: HomeCityDeps) {}
  async execute(): Promise<CityView | null> {
    const id = await this.d.homeCities.homeCityId();
    const city = id ? cityById(id) : null;
    return city ? toCityView(city) : null;
  }
}

/** Sets (or, with null, clears) the Home City. Only catalogue cities can be chosen. */
export class ChooseHomeCity {
  constructor(private readonly d: HomeCityDeps) {}
  async execute(cityId: string | null): Promise<void> {
    if (cityId !== null) {
      homeCityFromCatalogue(cityId);
    }
    if ((await this.d.homeCities.homeCityId()) === cityId) {
      return;
    }
    const now = this.d.clock.now();
    const event: HomeCityChosen = { type: 'HomeCityChosen', v: 1, at: now, cityId };
    await this.d.homeCities.saveHomeCity(cityId, event, now);
    this.d.afterCommit();
  }
}

/** Catalogue search for the city picker (accent-insensitive; empty query = every city). */
export class SearchCities {
  execute(query: string): CityView[] {
    return searchCities(CITY_CATALOG, query).map(toCityView);
  }
}
