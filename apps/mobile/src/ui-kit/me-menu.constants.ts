import type { Href } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';

export const ITEMS: { label: string; href: Href; symbol: SFSymbol; glyph: string; testID: string }[] = [
  { label: 'Profile', href: '/profile', symbol: 'person.crop.circle', glyph: '◉', testID: 'me-menu-profile' },
  { label: 'Account', href: '/account', symbol: 'key', glyph: '⚿', testID: 'me-menu-account' },
  { label: 'City', href: '/city', symbol: 'building.2', glyph: '⌂', testID: 'me-menu-city' },
  { label: 'Info', href: '/info', symbol: 'info.circle', glyph: 'ⓘ', testID: 'me-menu-info' },
];

/** Drawer slide and snap-back (0 with Reduce Motion on). */
export const DURATION_MS = 200;
export const CLOSE_DRAG_PX = 80;
