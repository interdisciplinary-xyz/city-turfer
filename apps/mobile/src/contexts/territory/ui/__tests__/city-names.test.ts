import { createTerritoryApi } from '@/contexts/territory';
import { MESSAGES } from '@/i18n/catalogue';
import { applyLanguageSetting, resetLanguageStateForTests } from '@/i18n/language-state';

import { cityAliases, cityName, countryName } from '../city-names';

const search = createTerritoryApi({ districts: { districtsOf: () => [] } } as unknown as Parameters<
  typeof createTerritoryApi
>[0]).searchCities;
const ALL = search.execute('');

beforeEach(() => resetLanguageStateForTests('en-US'));

describe('city names in the catalogue', () => {
  it('has every catalogue city in both languages, English exactly core’s name', () => {
    expect(Object.keys(MESSAGES.en.cities.names).sort()).toEqual(ALL.map((c) => c.id).sort());
    expect(Object.keys(MESSAGES.pl.cities.names).sort()).toEqual(ALL.map((c) => c.id).sort());
    for (const c of ALL) {
      expect(cityName(c, 'en')).toBe(c.name);
    }
  });

  it('has a country name for every catalogue country in both languages', () => {
    for (const c of ALL) {
      expect(countryName(c.country, 'en')).not.toBe(c.country);
      expect(countryName(c.country, 'pl')).not.toBe(c.country);
    }
  });

  it('uses the Polish exonyms in Polish', () => {
    const pl = (id: string) =>
      cityName(
        ALL.find((c) => c.id === id)!,
        'pl'
      );
    expect(
      ['pl-warsaw', 'cz-prague', 'at-vienna', 'it-rome', 'dk-copenhagen', 'lt-vilnius', 'pt-lisbon'].map(pl)
    ).toEqual(['Warszawa', 'Praga', 'Wiedeń', 'Rzym', 'Kopenhaga', 'Wilno', 'Lizbona']);
    expect(pl('pl-krakow')).toBe('Kraków');
    expect(countryName('PL', 'pl')).toBe('Polska');
  });

  it('follows the app language by default', () => {
    const warsaw = ALL.find((c) => c.id === 'pl-warsaw')!;
    expect(cityName(warsaw)).toBe('Warsaw');
    expect(countryName('PL')).toBe('Poland');
    applyLanguageSetting('pl', 'en-US');
    expect(cityName(warsaw)).toBe('Warszawa');
    expect(countryName('PL')).toBe('Polska');
  });

  it('falls back to core’s name and the code for what the catalogue lacks', () => {
    expect(cityName({ id: 'xx-atlantis', name: 'Atlantis' }, 'pl')).toBe('Atlantis');
    expect(countryName('XX', 'pl')).toBe('XX');
  });
});

describe('city search with the localised names', () => {
  const ids = (q: string) => search.execute(q, cityAliases).map((c) => c.id);

  it('finds a city by its Polish or English name, without accents, whatever the language', () => {
    expect(ids('warszawa')).toEqual(['pl-warsaw']);
    expect(ids('warsaw')).toEqual(['pl-warsaw']);
    expect(ids('wieden')).toEqual(['at-vienna']);
    expect(ids('vienna')).toEqual(['at-vienna']);
    expect(ids('kopenh')).toEqual(['dk-copenhagen']);
    expect(ids('krakow')).toEqual(['pl-krakow']);
  });

  it('keeps core’s name in the views (the picker localises for display)', () => {
    expect(search.execute('rzym', cityAliases)).toMatchObject([{ id: 'it-rome', name: 'Rome' }]);
  });
});
