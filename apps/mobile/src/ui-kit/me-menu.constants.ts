import type { Href } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';

/** A menu item's label key in the `me` namespace (`items.<key>`). */
export type MeMenuItemKey = 'profile' | 'account' | 'city' | 'info';

export const ITEMS: { key: MeMenuItemKey; href: Href; symbol: SFSymbol; glyph: string; testID: string }[] = [
  { key: 'profile', href: '/profile', symbol: 'person.crop.circle', glyph: '◉', testID: 'me-menu-profile' },
  { key: 'account', href: '/account', symbol: 'key', glyph: '⚿', testID: 'me-menu-account' },
  { key: 'city', href: '/city', symbol: 'building.2', glyph: '⌂', testID: 'me-menu-city' },
  { key: 'info', href: '/info', symbol: 'info.circle', glyph: 'ⓘ', testID: 'me-menu-info' },
];

/** Drawer slide and snap-back (0 with Reduce Motion on). */
export const DURATION_MS = 200;
export const CLOSE_DRAG_PX = 80;
