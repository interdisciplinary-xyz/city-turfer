import type * as Location from 'expo-location';

import { toFix, toFixOn } from '../expo-location-tracker';

// Jest runs in plain node here (no jest-expo preset): stub the native modules the adapter imports.
jest.mock('expo-location', () => ({}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../background-activity-session', () => ({ backgroundActivitySession: {} }));
// The notification text reads the saved Language setting from the secure store.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined }));

const loc = (coords: Partial<Location.LocationObjectCoords>): Location.LocationObject => ({
  timestamp: 1_767_250_800_000,
  coords: {
    latitude: 52.2,
    longitude: 21,
    altitude: 110,
    accuracy: 5,
    altitudeAccuracy: 3,
    heading: 0,
    speed: 2.5,
    ...coords,
  },
});

describe('toFix (expo-location ACL)', () => {
  it('maps a full reading', () => {
    expect(toFixOn(loc({}), 'ios')).toEqual({
      lat: 52.2,
      lon: 21,
      t: 1_767_250_800_000,
      accuracy: 5,
      alt: 110,
      speed: 2.5,
    });
  });

  it.each(['ios', 'android'] as const)('%s: negative speed and nulls mean unknown', (os) => {
    expect(toFixOn(loc({ speed: -1, altitude: null, accuracy: null }), os)).toMatchObject({
      speed: null,
      alt: null,
      accuracy: null,
    });
  });

  it('android: 0 speed and 0 altitude are "no data" (no hasSpeed/hasAltitude check upstream)', () => {
    expect(toFixOn(loc({ speed: 0, altitude: 0 }), 'android')).toMatchObject({ speed: null, alt: null });
  });

  it('android: non-zero readings pass through', () => {
    expect(toFixOn(loc({ speed: 0.4, altitude: -2 }), 'android')).toMatchObject({ speed: 0.4, alt: -2 });
  });

  it('ios: 0 speed and 0 altitude are real readings and are kept', () => {
    expect(toFixOn(loc({ speed: 0, altitude: 0 }), 'ios')).toMatchObject({ speed: 0, alt: 0 });
  });

  it('stays unary so locations.map(toFix) is safe, and uses the running platform', () => {
    expect(toFix.length).toBe(1);
    const [f] = [loc({ speed: 0 })].map(toFix); // Platform.OS mocked as android
    expect(f).toMatchObject({ lat: 52.2, speed: null });
  });
});
