const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
}));

import { ENGLISH_DEFAULT_NAME_WORDS, type PartOfDay } from '@cityturfer/core/activity-log';

import { LANGUAGE_SETTING_KEY } from '@/i18n/language-setting';
import { applyLanguageSetting, resetLanguageStateForTests } from '@/i18n/language-state';
import { migrate } from '@/platform/migrations';
import { openNodeDatabase } from '@/test-support/node-database';
import { wire } from '@/wiring';

import { catalogueDefaultNameWords, currentDefaultNameWords } from '../catalogue-default-name-words';

const PARTS: PartOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
const TYPES = ['walk', 'run', 'cycle'] as const;

beforeEach(() => resetLanguageStateForTests('en-US'));

describe('catalogueDefaultNameWords', () => {
  it('gives exactly core’s English names in English', () => {
    const en = catalogueDefaultNameWords('en');
    for (const part of PARTS) {
      for (const type of TYPES) {
        expect(en(part, type)).toBe(ENGLISH_DEFAULT_NAME_WORDS(part, type));
      }
    }
  });

  it('gives whole, inflected Polish names', () => {
    const pl = catalogueDefaultNameWords('pl');
    expect(pl('morning', 'run')).toBe('Poranny bieg');
    expect(pl('afternoon', 'walk')).toBe('Popołudniowy spacer');
    expect(pl('evening', 'walk')).toBe('Wieczorny spacer');
    expect(pl('night', 'cycle')).toBe('Nocna przejażdżka');
    expect(pl('morning', 'cycle')).toBe('Poranna przejażdżka');
  });

  it('follows the app language at call time', () => {
    expect(catalogueDefaultNameWords()('morning', 'run')).toBe('Morning run');
    applyLanguageSetting('pl', 'en-US');
    expect(catalogueDefaultNameWords()('morning', 'run')).toBe('Poranny bieg');
  });
});

describe('new Activities through the wiring', () => {
  const T0 = new Date(2026, 9, 1, 7, 0).getTime(); // 07:00 local: a morning
  const walk = Array.from({ length: 10 }, (_, i) => ({
    lat: 52.25 + i * 0.0005,
    lon: 21.01,
    t: T0 + i * 10_000,
    segment: 0,
    alt: null,
    accuracy: null,
    speed: null,
  }));

  async function container() {
    const db = openNodeDatabase();
    await migrate(db);
    return wire('test', db, {
      tracker: {
        start: async () => undefined,
        stop: async () => undefined,
        isRunning: async () => false,
        reacquire: async () => null,
      },
      permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
      notifier: { publish: () => undefined },
      router: { route: async () => null },
      ids: { next: () => 'id-1' },
      clock: { now: () => T0 + 3_600_000 },
      defaultNameWords: currentDefaultNameWords,
    });
  }

  it('are named in Polish when the saved setting is Polski (read first, as on a headless launch)', async () => {
    mockStore.set(LANGUAGE_SETTING_KEY, 'pl');
    const c = await container();
    await c.activityLog.importActivity.execute({ id: 'a1', type: 'walk', points: walk });
    expect((await c.activityLog.list.execute(10)).map((a) => a.name)).toEqual(['Poranny spacer']);
  });

  it('keep the name they got when the language changes later', async () => {
    applyLanguageSetting('en', 'en-US');
    const c = await container();
    await c.activityLog.importActivity.execute({ id: 'a1', type: 'run', points: walk });
    applyLanguageSetting('pl', 'en-US');
    await c.activityLog.importActivity.execute({
      id: 'a2',
      type: 'run',
      points: walk.map((p) => ({ ...p, t: p.t + 1 })),
    });
    const names = Object.fromEntries((await c.activityLog.list.execute(10)).map((a) => [a.id, a.name]));
    expect(names).toEqual({ a1: 'Morning run', a2: 'Poranny bieg' });
  });
});
