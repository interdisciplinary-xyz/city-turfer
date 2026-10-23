import { isLanguageSetting, regionalLocale, resolveLocale } from '../locales';

describe('resolveLocale', () => {
  it('uses the chosen language whatever the phone speaks', () => {
    expect(resolveLocale('pl', 'en-US')).toBe('pl');
    expect(resolveLocale('en', 'pl-PL')).toBe('en');
  });

  it('follows a Polish phone on System, in any region or spelling', () => {
    for (const tag of ['pl', 'pl-PL', 'pl_PL', 'PL-pl', 'pl-u-nu-latn']) {
      expect(resolveLocale('system', tag)).toBe('pl');
    }
  });

  it('falls back to English for any other or missing phone language', () => {
    for (const tag of ['en-GB', 'de-DE', 'uk-UA', 'plt', '', null, undefined]) {
      expect(resolveLocale('system', tag)).toBe('en');
    }
  });
});

describe('isLanguageSetting', () => {
  it('accepts exactly system, en and pl', () => {
    expect(['system', 'en', 'pl'].every(isLanguageSetting)).toBe(true);
    expect([null, '', 'de', 'PL', 1].some(isLanguageSetting)).toBe(false);
  });
});

describe('regionalLocale', () => {
  it("keeps the phone's region when it speaks the app language", () => {
    expect(regionalLocale('en', 'en-GB')).toBe('en-GB');
    expect(regionalLocale('pl', 'pl-PL')).toBe('pl-PL');
  });

  it('drops Unicode extensions and uses the bare app locale otherwise', () => {
    expect(regionalLocale('en', 'en-GB-u-nu-arab')).toBe('en-GB');
    expect(regionalLocale('en', 'de-DE')).toBe('en');
    expect(regionalLocale('pl', 'en-US')).toBe('pl');
  });
});
