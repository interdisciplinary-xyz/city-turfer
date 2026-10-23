import type { ColorScheme } from '@cityturfer/brand';
import type { ReactNode } from 'react';

export type ThemeProviderProps = {
  /** Forces a colour scheme (Storybook's SITE_SCHEME, night map panels). Omit to follow the device. */
  scheme?: ColorScheme;
  children: ReactNode;
};
