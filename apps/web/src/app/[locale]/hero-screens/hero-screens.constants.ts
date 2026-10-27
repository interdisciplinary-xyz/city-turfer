/** The two app screens in the hero, each a coded prototype on a 390 × 844 canvas. */
export const HERO_SCREENS = ['turfMap', 'dashboard'] as const;

export type HeroScreenKey = (typeof HERO_SCREENS)[number];

/** The design canvas (iPhone 390 × 844 points); hero-screens.css scales it to the phone frame. */
export const PROTO_WIDTH = 390;
export const PROTO_HEIGHT = 844;

/** The example turf on both screens (the same numbers as the old Turf Map screenshot). */
export const EXAMPLE_TURF = { areaKm2: 3.02, cells: 1530, strong: 686, weekKm2: 0.06 } as const;

/** The example user greeted on the Dashboard screen. */
export const EXAMPLE_NAME = 'Adam';

/** The tab bar, in the app's order (apps/mobile/src/app/(tabs)). */
export const TABS = ['dashboard', 'turf', 'record', 'stats', 'me'] as const;

export type TabKey = (typeof TABS)[number];

/**
 * Streets on the stylised map, in canvas points: a loose grid of avenues and side streets, not a
 * real city. Drawn hairline-thin under the routes.
 */
export const MAP_STREETS: readonly string[] = [
  'M-10 250 L400 120',
  'M-10 330 L400 260',
  'M-10 470 L400 430',
  'M-10 560 L400 590',
  'M-10 690 L400 640',
  'M-10 790 L400 760',
  'M40 140 L120 860',
  'M130 120 L170 860',
  'M215 120 L250 860',
  'M300 120 L290 860',
  'M360 120 L380 860',
  'M-10 400 L180 300 L400 360',
  'M60 860 L190 610 L400 520',
  'M-10 620 L120 560 L240 470',
  'M150 860 L210 700 L330 680 L400 700',
];

/** The river: one wide, slightly lighter band from the north-east to the south-east. */
export const MAP_RIVER = 'M300 110 C 270 220, 300 300, 300 360 S 360 470, 350 560 S 300 700, 340 860';

/** A point on the canvas, in points: [x, y]. */
export type MapPoint = readonly [number, number];

export type MapTier = 'faint' | 'glowing' | 'strong' | 'blazing';

/** Where the location dot sits (home). */
export const MAP_HOME = { x: 272, y: 372 } as const;

/**
 * Turf routes as points (smoothed into curves when drawn), weakest first so the brightest glow on
 * top: a long loop to the west, a tail to the south-west, loops around home in the east, and the
 * daily line south of home, walked so often it blazes.
 */
export const MAP_ROUTES: readonly { points: readonly MapPoint[]; tier: MapTier }[] = [
  {
    tier: 'glowing',
    points: [
      [272, 372],
      [240, 346],
      [200, 320],
      [150, 302],
      [96, 288],
      [58, 284],
      [48, 306],
      [62, 346],
      [58, 394],
      [66, 430],
      [102, 442],
      [160, 448],
      [214, 455],
      [248, 462],
    ],
  },
  {
    tier: 'glowing',
    points: [
      [248, 462],
      [226, 504],
      [198, 548],
      [170, 588],
      [136, 610],
      [98, 620],
    ],
  },
  {
    tier: 'strong',
    points: [
      [272, 372],
      [262, 336],
      [270, 306],
      [292, 300],
      [302, 330],
      [318, 352],
      [346, 366],
      [342, 386],
      [310, 384],
      [272, 372],
    ],
  },
  {
    tier: 'strong',
    points: [
      [222, 404],
      [240, 392],
      [272, 372],
      [296, 398],
      [308, 414],
    ],
  },
  {
    tier: 'blazing',
    points: [
      [272, 372],
      [268, 410],
      [258, 440],
      [248, 462],
    ],
  },
  {
    tier: 'blazing',
    points: [
      [272, 372],
      [292, 362],
      [318, 352],
    ],
  },
];

/** District labels on the map, as the basemap prints them (place names, not translated). */
export const MAP_LABELS: readonly { name: string; x: number; y: number }[] = [
  { name: 'BIELANY', x: 64, y: 236 },
  { name: 'ŻOLIBORZ', x: 160, y: 286 },
  { name: 'PRAGA-PÓŁNOC', x: 290, y: 300 },
  { name: 'WOLA', x: 92, y: 440 },
  { name: 'OCHOTA', x: 140, y: 556 },
  { name: 'MOKOTÓW', x: 330, y: 646 },
  { name: 'WŁOCHY', x: 66, y: 684 },
];
