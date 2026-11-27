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
    mockStore.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    mockStore.delete(k);
  },
}));

import { SecureStoreRoutingConsent } from '../secure-store-routing-consent';

beforeEach(() => {
  mockStore.clear();
  mockState.failing = false;
});

describe('SecureStoreRoutingConsent', () => {
  it('is unasked (nothing sent) until the Turfer answers, per profile', async () => {
    const mine = new SecureStoreRoutingConsent('u1');
    expect(await mine.state()).toBe('unasked');
    await mine.set(true);
    expect(await mine.state()).toBe('granted');
    expect(await new SecureStoreRoutingConsent('u1').state()).toBe('granted');
    expect(await new SecureStoreRoutingConsent('u2').state()).toBe('unasked');
    await mine.set(false);
    expect(await new SecureStoreRoutingConsent('u1').state()).toBe('declined');
  });

  it('reads as unasked when the keychain is unreadable', async () => {
    mockStore.set('cityturfer.route-planning.routing-consent.u1', '1');
    mockState.failing = true;
    expect(await new SecureStoreRoutingConsent('u1').state()).toBe('unasked');
  });

  it("forgets a deleted profile's answer", async () => {
    await new SecureStoreRoutingConsent('u1').set(true);
    await SecureStoreRoutingConsent.forget('u1');
    expect(await new SecureStoreRoutingConsent('u1').state()).toBe('unasked');
  });
});
