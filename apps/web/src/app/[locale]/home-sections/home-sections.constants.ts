import { APP_SCHEME, cssVariables, TIER_ORDER } from '@cityturfer/brand';
import type { CSSProperties } from 'react';

/** The three activity types as the app names them (`cycle` is shown as "Ride"). */
export type HomeActivityType = 'walk' | 'run' | 'cycle';

/** The glyphs the app puts in its activity badges (apps/mobile/src/constants/activity.ts). */
export const TYPE_GLYPH: Record<HomeActivityType, string> = { walk: '🚶', run: '🏃', cycle: '🚴' };

/** CSS class suffix per type: the site's variables call the ride colour `--ride`. */
export const TYPE_CLASS: Record<HomeActivityType, string> = { walk: 'walk', run: 'run', cycle: 'ride' };

export const HOME_TYPES: readonly HomeActivityType[] = ['walk', 'run', 'cycle'];

export const HOME_TIERS = TIER_ORDER;

/**
 * The app's colours (APP_SCHEME, dark) for every piece that draws turf tiers (the legend, the gain
 * card, the dashboard, the Record disc): the tiers glow on night, not on the light page (blazing is
 * 1.04:1 on white). Set as inline style, so only that piece and its children get the dark variables.
 */
export const APP_VARIABLES = cssVariables(APP_SCHEME) as CSSProperties;

/**
 * The example week on the Dashboard card: the same numbers as the Dashboard screenshot in the hero
 * (the Gdańsk demo profile), so the card and the phone agree. Copy keys live under home.week.
 */
export const EXAMPLE_WEEK = { distanceKm: 43.64, time: '2:41:33', count: 4 } as const;

export type ExampleActivity = {
  key: 'walk' | 'run' | 'ride';
  type: HomeActivityType;
  distanceKm: number;
  /** Moving time, as the app prints it. */
  time: string;
  /** Pace per km for walks and runs; rides show speed instead. */
  pace?: string;
  speedKmh?: number;
};

export const EXAMPLE_ACTIVITIES: readonly ExampleActivity[] = [
  { key: 'walk', type: 'walk', distanceKm: 2.89, time: '30:45', pace: '10:39' },
  { key: 'run', type: 'run', distanceKm: 9.01, time: '49:30', pace: '5:30' },
  { key: 'ride', type: 'cycle', distanceKm: 17.85, time: '45:33', speedKmh: 23.5 },
];

/** Achievements on the example card: unlocked of the app's total (packages/core achievements). */
export const EXAMPLE_ACHIEVEMENTS = { unlocked: 9, total: 20 } as const;

/** Turf gained on the example card (activity detail in the app). */
export const EXAMPLE_GAIN = { areaKm2: 0.12, added: 56, reinforced: 340 } as const;

/** Highlights tiles, in "wow" order; `iphone` marks a feature that only runs on iPhone today. */
export type HighlightKey = 'gain' | 'record' | 'health' | 'achievements' | 'city';
export const HIGHLIGHTS: readonly { key: HighlightKey; icon: string; iphone: boolean }[] = [
  { key: 'gain', icon: '⬢', iphone: false },
  { key: 'record', icon: '●', iphone: true },
  { key: 'health', icon: '♥', iphone: true },
  { key: 'achievements', icon: '★', iphone: false },
  { key: 'city', icon: '◎', iphone: false },
];

export const DIFFERS = ['repeats', 'fades', 'private'] as const;

/**
 * Where it stands: one list to update per release (docs-engineer checks it on "update all docs").
 * Keys under home.status.<column>.<item>. Apple Health: import ran on an iPhone (works), saving to it has not
 * been checked on a device (testing), see docs/product/product-brief.md.
 */
export const STATUS_COLUMNS = [
  { key: 'works', items: ['record', 'turf', 'history', 'health', 'languages'] },
  { key: 'testing', items: ['health', 'battery', 'backup'] },
  { key: 'notYet', items: ['android', 'store', 'gpx', 'sharing'] },
] as const;

/** FAQ questions in page order; the FAQPage JSON-LD is built from the same keys. */
export const FAQ_KEYS = ['when', 'free', 'battery', 'account', 'data', 'android', 'watch', 'cities'] as const;
