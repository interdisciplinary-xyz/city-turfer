const mockStore = new Map<string, string>();
const mockState = { failing: false };

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => {
    if (mockState.failing) {
      throw new Error('keychain locked');
    }
    return mockStore.get(k) ?? null;
  },
  setItemAsync: async (k: string, v: string) => {
    if (mockState.failing) {
      throw new Error('keychain locked');
    }
    mockStore.set(k, v);
  },
}));

import { createLanguageSettings } from '../language';
import { LANGUAGE_SETTING_KEY, SecureStoreLanguageSetting } from '../language-setting';
import { getLanguageState, resetLanguageStateForTests, subscribeLanguage } from '../language-state';

beforeEach(() => {
  mockStore.clear();
  mockState.failing = false;
  resetLanguageStateForTests('en-US');
});

describe('SecureStoreLanguageSetting', () => {
  const setting = new SecureStoreLanguageSetting();

  it('defaults to System', async () => {
    expect(await setting.get()).toBe('system');
  });

  it('keeps the choice under the device-wide key', async () => {
    await setting.set('pl');
    expect(mockStore.get(LANGUAGE_SETTING_KEY)).toBe('pl');
    expect(LANGUAGE_SETTING_KEY).toBe('cityturfer.settings.language');
    expect(await setting.get()).toBe('pl');
  });

  it('reads an unknown value or a locked keychain as System', async () => {
    mockStore.set(LANGUAGE_SETTING_KEY, 'de');
    expect(await setting.get()).toBe('system');
    mockState.failing = true;
    expect(await setting.get()).toBe('system');
  });

  it('says when saving failed', async () => {
    mockState.failing = true;
    await expect(setting.set('en')).rejects.toThrow('keychain locked');
  });

  it('works with any key-value store', async () => {
    const fake = new Map<string, string>([[LANGUAGE_SETTING_KEY, 'en']]);
    const own = new SecureStoreLanguageSetting({
      getItemAsync: async (k) => fake.get(k) ?? null,
      setItemAsync: async (k, v) => void fake.set(k, v),
    });
    expect(await own.get()).toBe('en');
  });
});

describe('createLanguageSettings', () => {
  it('starts on the phone language, not ready, and applies the saved setting once read', async () => {
    mockStore.set(LANGUAGE_SETTING_KEY, 'pl');
    expect(getLanguageState()).toMatchObject({ setting: 'system', locale: 'en', ready: false });
    const settings = createLanguageSettings();
    const calls = jest.fn();
    subscribeLanguage(calls);
    await settings.load();
    await settings.load(); // read once
    expect(getLanguageState()).toMatchObject({ setting: 'pl', locale: 'pl', system: 'en', ready: true });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('is ready on System when nothing was saved', async () => {
    await createLanguageSettings().load();
    expect(getLanguageState()).toMatchObject({ setting: 'system', locale: 'en', ready: true });
  });

  it('applies a choice at once and saves it', async () => {
    const settings = createLanguageSettings();
    await settings.load();
    const calls = jest.fn();
    subscribeLanguage(calls);
    await settings.set('pl');
    expect(getLanguageState().locale).toBe('pl');
    expect(mockStore.get(LANGUAGE_SETTING_KEY)).toBe('pl');
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('keeps a choice made while the saved value was still being read', async () => {
    mockStore.set(LANGUAGE_SETTING_KEY, 'en');
    const settings = createLanguageSettings();
    const loading = settings.load();
    await settings.set('pl');
    await loading;
    expect(getLanguageState().setting).toBe('pl');
  });

  it('still applies the choice when saving fails, and says so', async () => {
    const settings = createLanguageSettings();
    await settings.load();
    mockState.failing = true;
    await expect(settings.set('pl')).rejects.toThrow('keychain locked');
    expect(getLanguageState().locale).toBe('pl');
  });
});
