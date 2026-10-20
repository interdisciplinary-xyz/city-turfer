import { DomainError } from '../../../shared-kernel';
import type { City } from './city';

const city = (id: string, name: string, country: string, lat: number, lon: number, radiusKm: number): City => ({
  id,
  name,
  country,
  center: { lat, lon },
  radiusM: radiusKm * 1000,
});

/**
 * Cities a Turfer can choose as their Home City, bundled with the app (no geocoding service, works
 * offline, nothing about the choice leaves the phone). Poland first, biggest first, then major
 * European cities. Centres are the old town or main square; radii are rough built-up extents.
 * Ids are stored in the user's database: never rename or reuse one (removing is safe: an unknown
 * id reads as "no Home City").
 */
export const CITY_CATALOG: readonly City[] = [
  city('pl-warsaw', 'Warsaw', 'PL', 52.2297, 21.0122, 12),
  city('pl-krakow', 'Kraków', 'PL', 50.0617, 19.9373, 9),
  city('pl-lodz', 'Łódź', 'PL', 51.7592, 19.456, 8),
  city('pl-wroclaw', 'Wrocław', 'PL', 51.1079, 17.0385, 9),
  city('pl-poznan', 'Poznań', 'PL', 52.4084, 16.9341, 8),
  city('pl-gdansk', 'Gdańsk', 'PL', 54.3485, 18.6533, 9),
  city('pl-szczecin', 'Szczecin', 'PL', 53.4285, 14.5528, 8),
  city('pl-bydgoszcz', 'Bydgoszcz', 'PL', 53.1235, 18.0084, 7),
  city('pl-lublin', 'Lublin', 'PL', 51.2465, 22.5684, 6),
  city('pl-bialystok', 'Białystok', 'PL', 53.1325, 23.1688, 6),
  city('pl-katowice', 'Katowice', 'PL', 50.2584, 19.0275, 7),
  city('pl-gdynia', 'Gdynia', 'PL', 54.5189, 18.5305, 6),
  city('pl-czestochowa', 'Częstochowa', 'PL', 50.8118, 19.1203, 6),
  city('pl-radom', 'Radom', 'PL', 51.4027, 21.1471, 5),
  city('pl-rzeszow', 'Rzeszów', 'PL', 50.0412, 21.9991, 5),
  city('pl-torun', 'Toruń', 'PL', 53.0103, 18.6046, 6),
  city('pl-sosnowiec', 'Sosnowiec', 'PL', 50.2863, 19.1041, 5),
  city('pl-kielce', 'Kielce', 'PL', 50.8703, 20.6275, 5),
  city('pl-gliwice', 'Gliwice', 'PL', 50.2945, 18.6714, 5),
  city('pl-olsztyn', 'Olsztyn', 'PL', 53.7784, 20.4801, 5),
  city('pl-opole', 'Opole', 'PL', 50.6683, 17.9231, 5),
  city('pl-zielona-gora', 'Zielona Góra', 'PL', 51.9356, 15.5062, 5),
  city('pl-sopot', 'Sopot', 'PL', 54.4418, 18.5601, 3),
  city('de-berlin', 'Berlin', 'DE', 52.52, 13.405, 14),
  city('gb-london', 'London', 'GB', 51.5074, -0.1278, 15),
  city('fr-paris', 'Paris', 'FR', 48.8566, 2.3522, 9),
  city('es-madrid', 'Madrid', 'ES', 40.4168, -3.7038, 10),
  city('es-barcelona', 'Barcelona', 'ES', 41.3874, 2.1686, 7),
  city('it-rome', 'Rome', 'IT', 41.8933, 12.4829, 10),
  city('at-vienna', 'Vienna', 'AT', 48.2082, 16.3738, 10),
  city('cz-prague', 'Prague', 'CZ', 50.0875, 14.4213, 10),
  city('hu-budapest', 'Budapest', 'HU', 47.4979, 19.0402, 10),
  city('nl-amsterdam', 'Amsterdam', 'NL', 52.3728, 4.8936, 7),
  city('dk-copenhagen', 'Copenhagen', 'DK', 55.6761, 12.5683, 7),
  city('se-stockholm', 'Stockholm', 'SE', 59.3293, 18.0686, 8),
  city('lt-vilnius', 'Vilnius', 'LT', 54.6872, 25.2797, 7),
  city('ie-dublin', 'Dublin', 'IE', 53.3498, -6.2603, 8),
  city('pt-lisbon', 'Lisbon', 'PT', 38.7223, -9.1393, 7),
];

export function cityById(id: string): City | null {
  return CITY_CATALOG.find((c) => c.id === id) ?? null;
}

/** Rule: only a catalogue city can be the Home City. */
export function homeCityFromCatalogue(id: string): City {
  const city = cityById(id);
  if (!city) {
    throw new DomainError('home-city.unknown', id);
  }
  return city;
}
