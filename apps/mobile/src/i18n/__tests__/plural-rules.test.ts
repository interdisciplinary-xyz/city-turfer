import { installPluralRules, needsPluralRules } from '../plural-rules';

describe('the plural-rules guard', () => {
  it('leaves an engine with plural rules alone (Node, Jest)', () => {
    expect(needsPluralRules()).toBe(false);
    const load = jest.fn();
    expect(installPluralRules(undefined, load)).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the polyfill when any app locale needs it', () => {
    const load = jest.fn();
    expect(installPluralRules((l) => (l === 'pl' ? 'pl' : undefined), load)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('gives Polish its four categories on an engine without Intl.PluralRules (Hermes)', () => {
    const native = Object.getOwnPropertyDescriptor(Intl, 'PluralRules');
    try {
      delete (Intl as { PluralRules?: unknown }).PluralRules;
      let polish: string[] = [];
      jest.isolateModules(() => {
        // The translator imports the guard first, as on the phone.
        const { translator } = require('../translator') as typeof import('../translator');
        const t = translator('common', 'pl');
        polish = [1, 2, 5, 22, 25, 1.5].map((count) => t('minutes', { count }));
      });
      expect(polish).toEqual(['1 minuta', '2 minuty', '5 minut', '22 minuty', '25 minut', '1,5 minuty']);
      expect(Intl.PluralRules).toBeDefined();
      expect(Intl.PluralRules).not.toBe(native?.value);
      const pl = new Intl.PluralRules('pl');
      expect([1, 2, 5, 22, 25, 1.5].map((n) => pl.select(n))).toEqual(['one', 'few', 'many', 'few', 'many', 'other']);
      expect(new Intl.PluralRules('en').select(1)).toBe('one');
      expect(new Intl.PluralRules('en').select(2)).toBe('other');
    } finally {
      Object.defineProperty(Intl, 'PluralRules', native!);
    }
  });
});
