import { type ColorScheme, type Palette, THEMES } from '@cityturfer/brand';
import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import type { ThemeProviderProps } from './theme.constants';

const SchemeOverride = createContext<ColorScheme | undefined>(undefined);

/**
 * Optional: forces a colour scheme for everything below it. The app doesn't need it (components
 * follow the device setting); Storybook wraps every story in it for its light/dark toggle.
 */
export function ThemeProvider({ scheme, children }: ThemeProviderProps) {
  return <SchemeOverride.Provider value={scheme}>{children}</SchemeOverride.Provider>;
}

/** The colour scheme in effect: the nearest ThemeProvider's, else the device's. */
export function useScheme(): ColorScheme {
  const forced = useContext(SchemeOverride);
  const device = useColorScheme();
  return forced ?? (device === 'dark' ? 'dark' : 'light');
}

/** Theme colours (bg, card, text, muted, border, danger) for the scheme in effect. */
export function usePalette(): Palette {
  return THEMES[useScheme()];
}
