import { APP_SCHEME, cssVariables, TIER_ORDER } from '@cityturfer/brand';
import type { CSSProperties, ReactNode } from 'react';

import { ICON_FOR_HIGHLIGHT, type IconName } from '@/domains/homepage/components/icons/marketing-icon.constants';

/** The three activity types as the app names them (`cycle` is shown as "Ride"). */
export type HomeActivityType = 'walk' | 'run' | 'cycle';

/**
 * The glyphs the app puts in its activity badges (apps/mobile/src/constants/activity.ts). Only the phone
 * mock-ups (hero-screens) still draw these: they show the app as it is. The page's own cards use `Icon`.
 */
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

/**
 * Highlights tiles, in the plan's order (docs/plans/homepage-value-2026-11-19.md §3). `tag` is a
 * label under the tile: `iphone` for a feature that only runs on iPhone, `new` for one without a
 * device run yet (copy under home.highlights.<tag>). Update with the release (docs-engineer checks it).
 */
export type HighlightKey = 'gain' | 'districts' | 'goal' | 'achievements' | 'share' | 'health';
export type HighlightTag = 'iphone' | 'new';
export const HIGHLIGHTS: readonly { key: HighlightKey; icon: IconName; tag: HighlightTag | null }[] = [
  { key: 'gain', icon: ICON_FOR_HIGHLIGHT.gain, tag: null },
  { key: 'districts', icon: ICON_FOR_HIGHLIGHT.districts, tag: null },
  { key: 'goal', icon: ICON_FOR_HIGHLIGHT.goal, tag: null },
  { key: 'achievements', icon: ICON_FOR_HIGHLIGHT.achievements, tag: null },
  { key: 'share', icon: ICON_FOR_HIGHLIGHT.share, tag: 'new' },
  { key: 'health', icon: ICON_FOR_HIGHLIGHT.health, tag: 'iphone' },
];

/** The Privacy points, in order (keys under home.local). */
export const LOCAL_POINTS = ['phone', 'backup', 'portal', 'leaves', 'account', 'private', 'site'] as const;

/** The two "what's different" lines under the audience cards (the third, privacy, lives in Privacy). */
export const DIFFERS = ['repeats', 'fades'] as const;

/**
 * Where it stands, as a strip under the highlights: what is being tested and what is not there yet
 * (what works is the highlights above). One list to update per release (docs-engineer checks it on
 * "update all docs"). Keys under home.status.<column>.<item>. Apple Health: neither direction has a device
 * run of the current rules (import counts forward only since 2026-11-05, ran on the Simulator only;
 * saving has not been checked on a device), so both sit under testing, see docs/product/product-brief.md.
 */
export const STATUS_COLUMNS = [
  { key: 'testing', items: ['locked', 'healthImport', 'health', 'share', 'battery', 'backup'] },
  { key: 'notYet', items: ['account', 'store', 'android', 'gpx'] },
] as const;

/** FAQ questions in page order; the FAQPage JSON-LD is built from the same keys. */
export const FAQ_KEYS = [
  'when',
  'free',
  'battery',
  'account',
  'data',
  'android',
  'watch',
  'cities',
  'share',
  'goal',
  'language',
] as const;

/**
 * Anchor ids of the homepage sections, one per `Section` (`#how` etc.). Each section's heading id is
 * `<anchor>-title`, and the header's section links point at these. Keep them stable: they are
 * shared links.
 */
export const SECTION_ANCHORS = {
  how: 'how',
  app: 'app',
  who: 'who',
  privacy: 'privacy',
  faq: 'faq',
  join: 'join',
} as const;

export type SectionAnchor = (typeof SECTION_ANCHORS)[keyof typeof SECTION_ANCHORS];

export type SectionName = SectionAnchor;

export type SectionProps = {
  name: SectionName;
  /** Extra classes on the <section> (after `home-section`). */
  className?: string;
  /** A faint band behind the section (every other section). */
  band?: boolean;
  /** Classes on the inner `.wrap`. */
  wrapClassName?: string;
  children: ReactNode;
};

type SectionHeadBase = {
  /** The section's plain name, shown above the claim. */
  eyebrow: string;
  /** The claim (the h2). */
  title: string;
  /** One sentence under the claim. */
  lede?: ReactNode;
  /** 2 for a section (default); 3 for a block inside one, such as the street demo. */
  level?: 2 | 3;
};

/**
 * The heading's id is `<name>-title` for a section, or the given `titleId` for a block inside one
 * (then `name` is not needed).
 */
export type SectionHeadProps = SectionHeadBase &
  ({ name: SectionName; titleId?: undefined } | { name?: undefined; titleId: string });

/**
 * Join's trust row, in order (keys under home.join.trust): all true today. `eu` is about the waitlist
 * emails, so it shows only when the form does.
 */
export const TRUST_POINTS = ['cookies', 'eu', 'phone', 'backup'] as const;
