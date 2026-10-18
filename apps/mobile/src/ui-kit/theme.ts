import { useColorScheme } from 'react-native';

import { DARK, LIGHT } from '@/constants/colors';

export type Palette = typeof LIGHT;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
