import { translator } from '@/i18n/translator';
import { DomainError } from '@/shared-kernel';

import { describeImport, healthErrorKey } from '../ui/apple-health-card.constants';

const report = (imported: number, duplicates = 0, withoutRoute = 0) => ({
  at: 0,
  imported,
  duplicates,
  withoutRoute,
  skipped: 0,
});

describe('Apple Health card copy', () => {
  it('describes the last import in English, as Maestro flow 11 matches it', () => {
    const t = translator('health', 'en');
    expect(describeImport(report(1), t)).toBe('1 workout added');
    expect(describeImport(report(3), t)).toBe('3 workouts added');
    expect(describeImport(report(0, 2, 3), t)).toBe('0 workouts added · 2 already in CityTurfer · 3 without a route');
    expect(t('lastImport', { summary: describeImport(report(3), t) })).toBe('Last import: 3 workouts added');
    expect(t('importing', { count: 4 })).toBe('Importing… 4 added so far');
  });

  it('describes the last import in Polish with all plural forms', () => {
    const t = translator('health', 'pl');
    expect([1, 2, 5, 22, 25].map((n) => describeImport(report(n), t))).toEqual([
      'dodano 1 trening',
      'dodano 2 treningi',
      'dodano 5 treningów',
      'dodano 22 treningi',
      'dodano 25 treningów',
    ]);
    expect(describeImport(report(0, 1, 2), t)).toBe('dodano 0 treningów · 1 był już w CityTurfer · 2 bez trasy');
    expect(describeImport(report(3, 5), t)).toBe('dodano 3 treningi · 5 było już w CityTurfer');
    expect(t('lastImport', { summary: describeImport(report(1), t) })).toBe('Ostatni import: dodano 1 trening');
    expect(t('importing', { count: 5 })).toBe('Importowanie… dodano już 5 treningów');
  });

  it('never shows an error’s own text: known codes get their message, anything else the generic one', () => {
    expect(healthErrorKey(new DomainError('health.unavailable'))).toBe('errors.unavailable');
    expect(healthErrorKey(new Error('HKErrorDomain code 5: workout 1A2B…'))).toBe('errors.generic');
    expect(healthErrorKey(new DomainError('activity.not-found'))).toBe('errors.generic');
    expect(healthErrorKey('boom')).toBe('errors.generic');
    expect(translator('health', 'en')('errors.unavailable')).toBe('Apple Health is not available');
    expect(translator('health', 'pl')('errors.generic')).toBe(
      'Apple Health nie odpowiada. Spróbuj ponownie za chwilę.'
    );
  });
});
