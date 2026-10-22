import { type BrandActivityType, FONT_SIZE, LABEL_TRACKING, type TierName, TURF_LEGEND_TITLE } from '@cityturfer/brand';

/**
 * Words on the /branding page. The values (colours, type, spacing, copy lines) come from
 * @cityturfer/brand; the rationale mirrors docs/decisions/brand-foundations-2026-10-20.md and the
 * `brand-system` skill. Update all three together.
 */
export const BRANDING_TITLE = 'Brand definition';
export const BRANDING_DESCRIPTION =
  'CityTurfer brand definition: positioning, personality, logo, colour, type, visual language and accessibility.';
export const DECISION_DOC_URL =
  'https://github.com/interdisciplinary-xyz/city-turfer/blob/main/docs/decisions/brand-foundations-2026-10-20.md';

export type BrandSection = { id: string; label: string };
export const SECTIONS: readonly BrandSection[] = [
  { id: 'positioning', label: 'Positioning' },
  { id: 'icp', label: 'ICP' },
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

/**
 * Fact checks: brand lines the founder owns that the product no longer matches exactly. Shown
 * next to the line, with a proposed rewording; remove one when the founder decides.
 */
export type FactCheck = { line: string; today: string; proposal: string };
const WHAT_LEAVES_THE_PHONE =
  'Since v0.8.0, opt-in Cloud backup (off by default) uploads tracks and the Home City choice to the CityTurfer API. Map tiles load from OpenFreeMap, and GPS-gap estimates send the gap’s two end points to the OpenStreetMap router unless switched off in Info. Apple Health imports are uploaded only with a second, separate backup switch.';
export const POSITIONING_CHECK: FactCheck = {
  line: '“And your routes never leave your phone.”',
  today: WHAT_LEAVES_THE_PHONE,
  proposal: '“And your routes stay on your phone unless you choose to back them up.”',
};
export const ALTERNATIVES_CHECK: FactCheck = {
  line: 'Alternatives named',
  today:
    'The closest alternatives aren’t named: private lifetime maps (MoveMap imports Apple Health routes; Fog of World and Fogbreaker reveal streets for good). Against them, privacy and permanence aren’t unique (docs/product/market-landscape.md).',
  proposal: 'Name private lifetime maps too, and lead with what only CityTurfer does: the glow when you come back.',
};
export const PRIVACY_LINE_CHECK: FactCheck = {
  line: 'Privacy line',
  today: `${WHAT_LEAVES_THE_PHONE} Since v0.9.0 (on scope, not released), anyone other than the demo and admin profiles signs in with an emailed code: the email address goes to the CityTurfer API and the code is sent by Brevo. There’s no way in without an account yet (#112, merged 2026-10-22).`,
  proposal:
    'Keep the line for local-only use and add “Backup is optional and off until you turn it on” wherever backup appears. Brand-designer drafts, founder approves; then change PRIVACY_LINE in @cityturfer/brand.',
};
export const PILLAR_CHECK: FactCheck = {
  line: '“Local-first, no tracking.”',
  today:
    'In a GPS tracker, “no tracking” reads as a contradiction. What’s meant is no analytics and no ads; routes are recorded on purpose.',
  proposal:
    '“Local-first. No analytics, no ads.” Add “no account needed” only once there is a way in without an account (decision B1).',
};

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

/**
 * Ideal customer profile: a hypothesis, mirrored from docs/product/icp.md (update both together).
 * No interviews yet, so every line is an assumption; ids point at docs/product/discovery-board.md.
 */
export const ICP_NOTE = 'Hypothesis, 2026-10-22 · no interviews yet';
export const ICP_INTRO =
  'The Turfer to win first. Built from the product as it is and desk research, not from users: the discovery log is still empty. Five interviews with people who match the fit signals come before any launch spend.';

export type IcpField = { label: string; text: string };
export const ICP_PRIMARY = {
  name: 'The Apple Watch city walker',
  summary:
    'Walks, runs or rides the same city streets every week, with outdoor workouts and routes sitting unused in Apple Health.',
  job: 'When I head out for my usual walk or run, I want to see my city fill in and my regular streets glow, so everyday movement feels like it adds up to something.',
  fields: [
    {
      label: 'Who',
      text: '25–45, lives in a Polish city (Warsaw, Kraków, Wrocław, Poznań, Tri-City), iPhone and often an Apple Watch. Out several times a week, mostly on the same streets.',
    },
    {
      label: 'Moment',
      text: 'Past workouts with routes that nobody looks at; a new neighbourhood; wanting a reason to take a different street on the usual loop.',
    },
    {
      label: 'Uses today',
      text: 'Apple Fitness, Strava or Garmin Connect: a list of workouts (Strava’s personal heatmap is paid). Nothing rewards a repeated dog walk.',
    },
    {
      label: 'Why CityTurfer',
      text: 'Apple Health import fills in your past outdoor workouts that have a route, on day one. Coming back counts, so home streets blaze. Turf never decays and no one takes it. Routes stay on the phone unless they turn on backup. (Planned, not built: using the app without an account. Today a new user signs in with an emailed code, which creates a CityTurfer account.)',
    },
    {
      label: 'What puts them off',
      text: 'A login wall, rankings and rivals, turf that decays, battery drain, a map that shows where they live.',
    },
    {
      label: 'Where to find them',
      text: 'To test: city subreddits and Facebook groups, run clubs and parkrun, Apple Watch communities, Polish running and cycling media.',
    },
    {
      label: 'Would pay',
      text: 'Once, like Fog of World (~$30) or MoveMap ($24.99 lifetime), not a subscription. Assumption A7, untested; cloud backup now costs money to run, which a one-off price has to cover.',
    },
  ] satisfies IcpField[],
};

export const ICP_FIT: readonly string[] = [
  'iPhone, with outdoor walks, runs or rides recorded with a route in Apple Health (ideally Apple Watch)',
  'Two or more outings a week, on repeated routes',
  'Lives and moves in one city most of the year',
  'Prefers private to social; doesn’t post workouts publicly',
];
export const ICP_NOT_FIT: readonly string[] = [
  'Wants to compete, rank or take someone else’s turf',
  'Trains by numbers: heart rate zones, power, plans',
  'Android only, for now (no Health Connect import; recording unproven on a phone)',
  'Mostly drives, or moves between cities constantly',
];

export const ICP_CONTEXT =
  'Context (dated desk research): iOS is ~36 % of mobile in Poland (StatCounter, Sept 2026), so this profile reaches about a third of the market until Android is proven. Walking became Strava’s #2 activity in 2025; cycling is Poland’s most common sport (GUS 2025).';

export const ANDROID_CHECK: FactCheck = {
  line: '“Download for Android” (website)',
  today:
    'The website’s main call to action is an Android APK, while this profile is iPhone-first and Android recording hasn’t been checked on a real phone (docs/product/product-brief.md, assumption A3).',
  proposal: 'Decide whether the site leads with the waitlist until iOS TestFlight exists.',
};

export type IcpSegment = { name: string; who: string; gap: string };
export const ICP_TEST_SEGMENTS: readonly IcpSegment[] = [
  {
    name: '#everystreet completionist',
    who: 'Runner on CityStrides, or rider on Wandrer or Squadrats, who wants to finish every street of a city. Pays ~$40–50/yr today; hurt by Strava’s API restrictions (Nov 2024).',
    gap: 'Needs a street-completion %, which we don’t have: what 100 % city coverage means is still open.',
  },
  {
    name: 'Privacy-first solo walker',
    who: 'Avoids Strava because it’s public. Wants a lifetime map that stays on the phone; would pay once.',
    gap: 'Hardest to reach. Trust needs a privacy policy and an honest line about opt-in backup.',
  },
];

export const ICP_NOT_NOW: readonly IcpField[] = [
  {
    label: 'Territory-capture players',
    text: 'StreetSiege, INTVL, Konquo: they want rivals, crews and seasons, which we don’t do.',
  },
  { label: 'Performance athletes', text: 'They want training analytics, not a map of their city.' },
];

export type IcpTest = { id: string; claim: string; test: string; bar: string };
export const ICP_TESTS: readonly IcpTest[] = [
  {
    id: 'A4',
    claim: 'Health import creates a day-one “wow”',
    test: 'Watch 5 people with Watch history import and react',
    bar: '≥ 4/5 react positively unprompted',
  },
  {
    id: 'A1',
    claim: 'Glow on return is a reason to go out again',
    test: '2–3 week diary study, 8 testers',
    bar: '≥ 5/8 mention turf or glow as a reason to go out',
  },
  {
    id: 'A6',
    claim: 'Walkers are the best-fit segment',
    test: 'Waitlist question “Walk, run or ride?” and interviews',
    bar: 'Walkers ≥ 40 % of sign-ups and most “very disappointed” answers',
  },
  {
    id: 'A5',
    claim:
      '“Routes on your phone, no account” wins choices (needs a way in without an account before the test is honest)',
    test: 'Website headline variants: privacy vs glow',
    bar: 'Privacy variant sign-ups ≥ glow variant',
  },
];
export const ICP_DOC_URL = 'https://github.com/interdisciplinary-xyz/city-turfer/blob/main/docs/product/icp.md';

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
  `Labels are uppercase system text, ${FONT_SIZE.label}–${FONT_SIZE.caption} px, weight 600–700, with ${LABEL_TRACKING} px tracking.`,
  'Archivo Expanded is wide: use it sparingly, track it −2% to −4%, and check long Polish lines at 320–375 px.',
];

/** One sample per type size, set in the face that uses it (display, numbers or the system font). */
export type ScaleSample = { text: string; className: string };
export const SCALE_SAMPLE: Record<keyof typeof FONT_SIZE, ScaleSample> = {
  label: { text: TURF_LEGEND_TITLE, className: 'brand-label' },
  caption: { text: 'Every street you cover becomes yours.', className: 'brand-scale-body' },
  unit: { text: 'Every street you cover becomes yours.', className: 'brand-scale-body' },
  body: { text: 'Every street you cover becomes yours.', className: 'brand-scale-body' },
  lead: { text: 'Every street you cover becomes yours.', className: 'brand-scale-body' },
  stat: { text: '12.48 km', className: 'brand-num' },
  hero: { text: 'Own your streets', className: 'brand-scale-sample' },
};

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
    text: 'SF Symbols on iOS. Android shows text glyphs today; Material Symbols in the same outline style are the target. Outline by default, filled when selected, one weight per screen.',
  },
  {
    name: 'Motion',
    text: 'Things glow up, they don’t bounce. UI transitions 150–250 ms ease-out; celebrations 600–900 ms brightening along the Ramp; a light haptic on a claim. Always honour reduce motion. Not built yet: celebrations and the claim haptic.',
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
export const CONTRAST_FIXES_NOTE =
  'From v0.9.0 the app and the website are dark only, so the light-theme rows matter for Storybook and any future light surface; the glow button and Hold to finish rows affect every screen.';

export type BrandAsset = { name: string; where: string; note: string };
export const ASSETS: readonly BrandAsset[] = [
  {
    name: 'Mark, adaptive foreground, monochrome, wordmarks (dark and light)',
    where: 'packages/brand/svg/',
    note: 'SVG sources; wordmarks are outlined by packages/brand/scripts/outline-wordmark.py',
  },
  { name: 'App icon and splash', where: 'apps/mobile/assets/brand/out/', note: 'Native: ship only with a reinstall' },
  {
    name: 'Social image 1200×630',
    where: 'apps/web/public/og-image.png',
    note: 'From packages/brand/templates/og-image.html',
  },
  {
    name: 'Store screenshots',
    where: 'apps/mobile/assets/brand/out/store/',
    note: 'App Store 1290×2796, Play 1080×2340. Rendered locally, not in git; the framed screens predate Archivo and the dark app, so recapture before submitting',
  },
  { name: 'Fonts (OFL)', where: 'packages/brand/fonts/', note: 'Archivo static cuts, TTF + WOFF2' },
];
export const RENDER_COMMAND = 'node apps/mobile/tools/brand/render-assets.mjs';
