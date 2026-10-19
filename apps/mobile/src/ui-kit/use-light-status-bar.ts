import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * Light status-bar content while this screen is focused, for screens that are always dark (Turf
 * Map, sign-in). The root layout's `<StatusBar style='auto' />` follows the system theme, which
 * gave dark icons on these screens when the phone is in light mode. Restores `auto` on blur.
 */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('auto');
    }, [])
  );
}
