import type { Clock } from '../../../shared-kernel';
import type { CityView, HomeCityChoice, HomeCityChosen } from '../contract';
import { type City, type CityAliases, cityBounds, searchCities } from '../domain/city';
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

/** Open-host service: the last Home City decision with its time (Cloud Backup: last write wins). */
export class HomeCityChoiceQuery {
  constructor(private readonly d: HomeCityDeps) {}
  execute(): Promise<HomeCityChoice | null> {
    return this.d.homeCities.homeCityChoice();
  }
}

/**
 * Sets (or, with null, clears) the Home City. Only catalogue cities can be chosen. `chosenAt` (epoch
 * ms) is when the Turfer made the choice, default now; a restored, older choice never replaces a
 * newer one (last write wins).
 */
export class ChooseHomeCity {
  constructor(private readonly d: HomeCityDeps) {}
  async execute(cityId: string | null, chosenAt?: number): Promise<void> {
    if (cityId !== null) {
      homeCityFromCatalogue(cityId);
    }
    const current = await this.d.homeCities.homeCityChoice();
    const at = chosenAt ?? this.d.clock.now();
    // An explicit (restored) time loses to a newer or equally old choice (the server keeps the one it
    // has on a tie too); the Turfer’s own choice now always counts.
    if (current && (current.cityId === cityId || (chosenAt != null && current.chosenAt >= at))) {
      return;
    }
    if (!current && cityId === null) {
      return; // nothing chosen, nothing to clear
    }
    const event: HomeCityChosen = { type: 'HomeCityChosen', v: 1, at: this.d.clock.now(), cityId, chosenAt: at };
    await this.d.homeCities.saveHomeCity(cityId, event, at);
    this.d.afterCommit();
  }
}

/**
 * Catalogue search for the city picker (accent-insensitive; empty query = every city). `aliases`
 * adds names to match per city id (the app's localised names); views keep the catalogue name.
 */
export class SearchCities {
  execute(query: string, aliases?: CityAliases): CityView[] {
    return searchCities(CITY_CATALOG, query, aliases).map(toCityView);
  }
}
