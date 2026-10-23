import { distanceM, DomainError } from '../../../../shared-kernel';
import { type City, cityBounds, foldForSearch, searchCities } from '../city';
import { CITY_CATALOG, cityById, homeCityFromCatalogue } from '../city-catalog';

const names = (cities: City[]) => cities.map((c) => c.name);

describe('foldForSearch', () => {
  it('drops case and accents, including letters NFD does not split', () => {
    expect(foldForSearch('Łódź')).toBe('lodz');
    expect(foldForSearch('Kraków')).toBe('krakow');
    expect(foldForSearch('  Częstochowa ')).toBe('czestochowa');
    expect(foldForSearch('København')).toBe('kobenhavn');
  });
});

describe('searchCities', () => {
  it('finds Polish cities typed without Polish letters', () => {
    expect(names(searchCities(CITY_CATALOG, 'krakow'))).toEqual(['Kraków']);
    expect(names(searchCities(CITY_CATALOG, 'lodz'))).toEqual(['Łódź']);
    expect(names(searchCities(CITY_CATALOG, 'GDAN'))).toEqual(['Gdańsk']);
  });

  it('ranks names starting with the query before word starts and inner matches', () => {
    // Name starts (catalogue order), then a later word starting with "g", then "g" inside a name.
    expect(names(searchCities(CITY_CATALOG, 'g')).slice(0, 5)).toEqual([
      'Gdańsk',
      'Gdynia',
      'Gliwice',
      'Zielona Góra',
      'Bydgoszcz',
    ]);
    expect(names(searchCities(CITY_CATALOG, 'gora'))).toEqual(['Zielona Góra']);
  });

  it('returns the whole catalogue, in order, for an empty query', () => {
    expect(searchCities(CITY_CATALOG, ' ')).toEqual([...CITY_CATALOG]);
  });

  it('returns nothing when no name matches', () => {
    expect(searchCities(CITY_CATALOG, 'atlantis')).toEqual([]);
  });

  describe('with aliases', () => {
    const POLISH: Record<string, string[]> = {
      'pl-warsaw': ['Warszawa'],
      'at-vienna': ['Wiedeń'],
      'it-rome': ['Rzym'],
    };
    const aliases = (id: string) => POLISH[id] ?? [];

    it('matches an alias like the catalogue name, accent-insensitive, and keeps the catalogue name', () => {
      expect(names(searchCities(CITY_CATALOG, 'warszawa', aliases))).toEqual(['Warsaw']);
      expect(names(searchCities(CITY_CATALOG, 'wieden', aliases))).toEqual(['Vienna']);
      expect(names(searchCities(CITY_CATALOG, 'rzym', aliases))).toEqual(['Rome']);
    });

    it('still matches the catalogue name', () => {
      expect(names(searchCities(CITY_CATALOG, 'vienna', aliases))).toEqual(['Vienna']);
      expect(names(searchCities(CITY_CATALOG, 'warsaw', aliases))).toEqual(['Warsaw']);
    });

    it('ranks a city by its best-matching name', () => {
      // "wi": Wiedeń starts with it (rank 0); "Katowice" and others only contain it (rank 2).
      expect(names(searchCities(CITY_CATALOG, 'wi', aliases))).toEqual(['Vienna', 'Katowice', 'Sosnowiec', 'Gliwice']);
      expect(names(searchCities(CITY_CATALOG, 'w', aliases)).slice(0, 3)).toEqual(['Warsaw', 'Wrocław', 'Vienna']);
    });

    it('ignores an alias source that throws', () => {
      const broken = () => {
        throw new Error('no catalogue');
      };
      expect(names(searchCities(CITY_CATALOG, 'krakow', broken))).toEqual(['Kraków']);
    });
  });
});

describe('cityBounds', () => {
  it('spans the radius from the centre in every direction', () => {
    const warsaw = cityById('pl-warsaw')!;
    const [w, s, e, n] = cityBounds(warsaw);
    const { lat, lon } = warsaw.center;
    expect(distanceM({ lat, lon }, { lat: n, lon })).toBeCloseTo(warsaw.radiusM, -1);
    expect(distanceM({ lat, lon }, { lat: s, lon })).toBeCloseTo(warsaw.radiusM, -1);
    expect(distanceM({ lat, lon }, { lat, lon: e })).toBeCloseTo(warsaw.radiusM, -2);
    expect(distanceM({ lat, lon }, { lat, lon: w })).toBeCloseTo(warsaw.radiusM, -2);
  });
});

describe('CITY_CATALOG', () => {
  it('has unique, well-formed ids', () => {
    const ids = CITY_CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CITY_CATALOG) {
      expect(c.id).toMatch(new RegExp(`^${c.country.toLowerCase()}-[a-z-]+$`));
    }
  });

  it('has plausible centres and radii', () => {
    for (const c of CITY_CATALOG) {
      expect(Math.abs(c.center.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.center.lon)).toBeLessThanOrEqual(180);
      expect(c.radiusM).toBeGreaterThanOrEqual(2_000);
      expect(c.radiusM).toBeLessThanOrEqual(30_000);
    }
  });

  it('puts every Polish city in Poland', () => {
    for (const c of CITY_CATALOG.filter((x) => x.country === 'PL')) {
      expect(c.center.lat).toBeGreaterThan(49);
      expect(c.center.lat).toBeLessThan(54.9);
      expect(c.center.lon).toBeGreaterThan(14.1);
      expect(c.center.lon).toBeLessThan(24.2);
    }
  });

  it('returns null for unknown ids', () => {
    expect(cityById('xx-nowhere')).toBeNull();
  });

  it('only lets a catalogue city be the Home City', () => {
    expect(homeCityFromCatalogue('pl-lodz').name).toBe('Łódź');
    expect(() => homeCityFromCatalogue('xx-nowhere')).toThrow(DomainError);
  });
});
