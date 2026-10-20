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

import { turfOverlayPreference } from '../turf-overlay-preference';

beforeEach(() => {
  mockStore.clear();
  mockState.failing = false;
});

describe('turfOverlayPreference', () => {
  it('shows turf until the Turfer hides it', async () => {
    expect(await turfOverlayPreference.isShown('u1')).toBe(true);
    await turfOverlayPreference.setShown('u1', false);
    expect(await turfOverlayPreference.isShown('u1')).toBe(false);
    await turfOverlayPreference.setShown('u1', true);
    expect(await turfOverlayPreference.isShown('u1')).toBe(true);
  });

  it('keeps the choice per user', async () => {
    await turfOverlayPreference.setShown('u1', false);
    expect(await turfOverlayPreference.isShown('u2')).toBe(true);
  });

  it('falls back to shown and never throws when storage fails', async () => {
    mockState.failing = true;
    await expect(turfOverlayPreference.setShown('u1', false)).resolves.toBeUndefined();
    expect(await turfOverlayPreference.isShown('u1')).toBe(true);
  });
});
