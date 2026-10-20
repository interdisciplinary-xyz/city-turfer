import { DomainError } from '../../../../shared-kernel';
import { catalogueCityView } from '../home-city';

describe('catalogueCityView', () => {
  it('answers a catalogue city as a view with [lon, lat] centre and bounds', () => {
    const warsaw = catalogueCityView('pl-warsaw');
    expect(warsaw).toMatchObject({ id: 'pl-warsaw', name: 'Warsaw', country: 'PL' });
    const [lon, lat] = warsaw.center;
    const [w, s, e, n] = warsaw.bounds;
    expect(w < lon && lon < e && s < lat && lat < n).toBe(true);
  });

  it('refuses an id outside the catalogue with home-city.unknown', () => {
    expect(() => catalogueCityView('xx-nowhere')).toThrow(DomainError);
    expect(() => catalogueCityView('xx-nowhere')).toThrow('home-city.unknown');
  });
});
