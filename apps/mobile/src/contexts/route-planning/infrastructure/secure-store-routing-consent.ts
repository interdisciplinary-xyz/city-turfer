import * as SecureStore from 'expo-secure-store';

import type { RoutingConsent } from '../application/ports';
import type { RoutingConsentState } from '../contract';

const key = (profileId: string) => `cityturfer.route-planning.routing-consent.${profileId}`;

/**
 * The Turfer's answer to "send Waypoints to the street router?", per profile (it is their location
 * data). Unset means unasked, and unasked sends nothing (opt-in); unreadable reads as unasked too.
 */
export class SecureStoreRoutingConsent implements RoutingConsent {
  private cached: RoutingConsentState | null = null;

  constructor(private readonly profileId: string) {}

  async state(): Promise<RoutingConsentState> {
    if (this.cached != null) {
      return this.cached;
    }
    let raw: string | null;
    try {
      raw = await SecureStore.getItemAsync(key(this.profileId));
    } catch {
      return 'unasked'; // unreadable: send nothing, ask again next time
    }
    this.cached = raw === '1' ? 'granted' : raw === '0' ? 'declined' : 'unasked';
    return this.cached;
  }

  async set(granted: boolean): Promise<void> {
    await SecureStore.setItemAsync(key(this.profileId), granted ? '1' : '0');
    this.cached = granted ? 'granted' : 'declined';
  }

  /** The profile's data was deleted from this phone. Throws when the keychain refuses. */
  static forget(profileId: string): Promise<void> {
    return SecureStore.deleteItemAsync(key(profileId));
  }
}
