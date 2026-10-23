import { applyLanguageSetting, resetLanguageStateForTests } from '../language-state';
import { messageFallback, translator } from '../translator';

beforeEach(() => resetLanguageStateForTests('en-US'));

describe('translator', () => {
  it('formats Polish plurals in all four categories, numbers with a decimal comma', () => {
    const t = translator('common', 'pl');
    expect(t('activities', { count: 1 })).toBe('1 aktywność');
    expect(t('activities', { count: 2 })).toBe('2 aktywności'); // few
    expect(t('activities', { count: 5 })).toBe('5 aktywności'); // many
    expect(t('activities', { count: 22 })).toBe('22 aktywności'); // few
    expect(t('activities', { count: 25 })).toBe('25 aktywności'); // many
    expect(t('activities', { count: 1.5 })).toBe('1,5 aktywności'); // other
    expect([1, 2, 5, 22, 25, 1.5].map((count) => t('minutes', { count }))).toEqual([
      '1 minuta',
      '2 minuty',
      '5 minut',
      '22 minuty',
      '25 minut',
      '1,5 minuty',
    ]);
  });

  it('picks the Polish category the CLDR rules give', () => {
    const pr = new Intl.PluralRules('pl');
    expect([1, 2, 5, 22, 25, 1.5].map((n) => pr.select(n))).toEqual(['one', 'few', 'many', 'few', 'many', 'other']);
  });

  it('formats English plurals', () => {
    const t = translator('common', 'en');
    expect(t('activities', { count: 1 })).toBe('1 activity');
    expect(t('activities', { count: 2 })).toBe('2 activities');
    expect(t('activities', { count: 1.5 })).toBe('1.5 activities');
  });

  it('reads the app language at call time', () => {
    expect(translator('common')('cancel')).toBe('Cancel');
    applyLanguageSetting('pl', 'en-US');
    expect(translator('common')('cancel')).toBe('Anuluj');
    applyLanguageSetting('system', 'pl-PL');
    expect(translator('common')('language.title')).toBe('Język');
    applyLanguageSetting('system', 'de-DE');
    expect(translator('common')('language.title')).toBe('Language');
  });

  it('writes the language names in their own language in every locale', () => {
    for (const locale of ['en', 'pl'] as const) {
      const t = translator('common', locale);
      expect([t('language.english'), t('language.polish')]).toEqual(['English', 'Polski']);
    }
  });

  it('never throws on an unknown key: shows the key', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const t = translator('common', 'pl');
    // @ts-expect-error keys are typed from the English catalogue
    expect(t('noSuchKey')).toBe('common.noSuchKey');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('MISSING_MESSAGE'));
    warn.mockRestore();
  });

  it('falls back to the English text, else the key', () => {
    expect(messageFallback({ namespace: 'common', key: 'cancel' })).toBe('Cancel');
    expect(messageFallback({ namespace: 'common', key: 'language.title' })).toBe('Language');
    expect(messageFallback({ namespace: 'common', key: 'nope' })).toBe('common.nope');
  });
});
