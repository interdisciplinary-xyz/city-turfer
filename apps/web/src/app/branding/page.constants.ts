import type { BrandActivityType, TierName } from '@cityturfer/brand';

/**
 * Words on the /branding page. The values (colours, type, spacing, copy lines) come from
 * @cityturfer/brand; the rationale mirrors docs/decisions/brand-foundations-2026-10-20.md and the
 * `brand-system` skill. Update all three together.
 */
export const BRANDING_TITLE = 'Brand definition';
export const BRANDING_DESCRIPTION =
  'CityTurfer brand definition: positioning, personality, logo, colour, type, visual language and accessibility.';
export const DECISION_DOC_URL =
  'https://github.com/interdisciplinary-xyz/city-turfer/blob/scope/v0.8.0/docs/decisions/brand-foundations-2026-10-20.md';

export type BrandSection = { id: string; label: string };
export const SECTIONS: readonly BrandSection[] = [
  { id: 'positioning', label: 'Positioning' },
  { id: 'personality', label: 'Personality' },
  { id: 'voice', label: 'Name & voice' },
  { id: 'logo', label: 'Logo' },
  { id: 'colour', label: 'Colour' },
  { id: 'type', label: 'Typography' },
  { id: 'layout', label: 'Spacing & radii' },
  { id: 'visual', label: 'Visual language' },
  { id: 'a11y', label: 'Accessibility' },
  { id: 'assets', label: 'Assets' },
];

export const POSITIONING =
  'For people who move through a city on foot or by bike, CityTurfer is the activity tracker that turns every street you cover into turf that is yours for good, and makes it glow brighter each time you come back. Unlike performance trackers (Strava, Garmin Connect), it doesn’t rank you against anyone; unlike street-completion apps (CityStrides, Wandrer), it rewards returning to the streets you love, not only ticking off new ones. And your routes never leave your phone.';

export type Audience = { name: string; want: string; lead: string };
export const AUDIENCES: readonly Audience[] = [
  {
    name: 'City explorers',
    want: 'Know and “collect” their city, street by street',
    lead: 'Every street you cover becomes yours.',
  },
  {
    name: 'Runners and cyclists',
    want: 'Variety and a reason to try new routes',
    lead: 'Walk it. Run it. Ride it. Own it.',
  },
  {
    name: 'Everyday movers',
    want: 'A quiet reward for walks, commutes, dog walks',
    lead: 'Your turf glows brighter each time you come back.',
  },
];

export type Trait = { we: string; weAre: string; notName: string; weAreNot: string };
export const PERSONALITY: readonly Trait[] = [
  {
    we: 'Confident',
    weAre: 'Short, direct, concrete numbers',
    notName: 'Boastful',
    weAreNot: 'Hype (“insane”, “crush it”)',
  },
  {
    we: 'Playful',
    weAre: 'Turf, glow, surfing the city',
    notName: 'Gamified-casino',
    weAreNot: 'Streaks you lose, loot, guilt',
  },
  {
    we: 'Outdoorsy',
    weAre: 'Streets, dusk, real places',
    notName: 'Gym culture',
    weAreNot: 'Bodies, calories first, no pain no gain',
  },
  {
    we: 'Private by default',
    weAre: 'Your phone, your data',
    notName: 'Social pressure',
    weAreNot: 'Leaderboards, followers',
  },
];

export type Pillar = { name: string; text: string };
export const PILLARS: readonly Pillar[] = [
  { name: 'Your streets', text: 'Ownership is permanent. Turf never decays.' },
  { name: 'The glow', text: 'Repetition is rewarded, visibly.' },
  { name: 'Yours alone', text: 'Local-first, no tracking.' },
];

export const NAME_RULES: readonly string[] = [
  'CityTurfer: one word, two capitals. Never Cityturfer, City Turfer, CITYTURFER or City-Turfer.',
  'Users are Turfers. Their claimed area is turf; one hexagon is a cell.',
  'Say “your turf”, “claim”, “glow”, “streets you own”. Never “score”, “points” or “conquer”; “territory” is a code term only.',
  'Short, active sentences in the second person. Celebrate what the user did, in concrete numbers.',
  'No guilt, no fake urgency, no leaderboard language.',
];

export const TIER_MEANING: Record<TierName, string> = {
  faint: 'Tier 1, gradient start',
  glowing: 'Tier 2 and the primary accent: buttons, selection, links',
  strong: 'Tier 3, highlights',
  blazing: 'Tier 4, “City” in the logotype, headlines on dark',
};

export const ACTIVITY_LABEL: Record<BrandActivityType, string> = { walk: 'Walk', run: 'Run', cycle: 'Ride' };

export type FontSpec = { role: string; family: string; cssVar: string; sample: string; use: string };
export const FONTS: readonly FontSpec[] = [
  {
    role: 'Display',
    family: 'Archivo Expanded Black · width 125, weight 900',
    cssVar: '--display',
    sample: 'Own your streets',
    use: 'Wordmark, hero, screen titles',
  },
  {
    role: 'Numeric',
    family: 'Archivo ExtraBold · weight 800, tabular figures',
    cssVar: '--numeric',
    sample: '12.48 km · 1:04:37',
    use: 'Big numbers: distance, time, area',
  },
  {
    role: 'Body',
    family: 'System · SF Pro, Roboto',
    cssVar: '--font-family-body',
    sample: 'Every street you cover becomes yours.',
    use: 'Body text, labels, buttons',
  },
];
export const TYPE_RULES: readonly string[] = [
  'The weight is part of each Archivo font: never add font-weight or bold, or Android falls back to the system font.',
  'Numbers always use tabular figures, so live stats don’t jitter.',
  'Labels are uppercase system text with 0.8 px tracking.',
];

export const VISUAL_LANGUAGE: readonly Pillar[] = [
  {
    name: 'Map is the hero',
    text: 'Product imagery is the real Turf Map: a desaturated dark basemap with turf glowing on it. Tier colours mean turf only; activity colours mean tracks only.',
  },
  {
    name: 'Motif',
    text: 'The hexagon cell and the street-wave from the mark build illustrations, empty states and patterns. No mascot, no characters.',
  },
  {
    name: 'Photography',
    text: 'Marketing only: city streets at dusk or night, human scale, people from behind or far away. Never stock fitness bodies or a recognisable person next to a route.',
  },
  {
    name: 'Icons',
    text: 'SF Symbols on iOS, Material Symbols on Android. Outline by default, filled when selected, one weight per screen.',
  },
  {
    name: 'Motion',
    text: 'Things glow up, they don’t bounce. UI transitions 150–250 ms ease-out; celebrations 600–900 ms brightening along the Ramp; a light haptic on a claim. Always honour reduce motion.',
  },
];

export type ContrastFix = { pair: string; today: string; fix: string };
export const CONTRAST_FIXES: readonly ContrastFix[] = [
  {
    pair: 'White label on the glow accent (buttons)',
    today: '3.5:1',
    fix: 'Night label on glow (5.5:1), or white on #C8137F (5.4:1)',
  },
  { pair: 'Glow as text or links on light theme', today: '3.3:1', fix: 'Light-theme accent text #C8137F (5.1:1)' },
  { pair: 'Danger on light theme', today: '3.7:1', fix: '#CF2F35 (4.8:1)' },
  {
    pair: 'Walk / run / ride lines on light',
    today: '1.8–2.4:1',
    fix: 'Light-map variants #14935C, #C85A12, #1477B8 (≥ 3.6:1)',
  },
  {
    pair: 'White label on danger (Hold to finish)',
    today: '2.9–3.9:1',
    fix: 'A deeper danger fill token, decided with the accent fix',
  },
];

export type BrandAsset = { name: string; where: string; note: string };
export const ASSETS: readonly BrandAsset[] = [
  { name: 'Mark, wordmark, monochrome', where: 'packages/brand/svg/', note: 'Outlined SVG sources' },
  { name: 'App icon and splash', where: 'apps/mobile/assets/brand/out/', note: 'Native: ship only with a reinstall' },
  { name: 'Social image 1200×630', where: 'apps/web/public/og-image.png', note: 'From templates/og-image.html' },
  {
    name: 'Store screenshots',
    where: 'apps/mobile/assets/brand/out/store/',
    note: 'App Store 1290×2796, Play 1080×2340',
  },
  { name: 'Fonts (OFL)', where: 'packages/brand/fonts/', note: 'Archivo static cuts, TTF + WOFF2' },
];
export const RENDER_COMMAND = 'node apps/mobile/tools/brand/render-assets.mjs';
