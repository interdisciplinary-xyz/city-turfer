/** Name and copy shared by the app, the landing page and store listings (`brand-system` skill). */
export const NAME = 'CityTurfer';
/** Taglines in order of preference. */
export const TAGLINES = [
  'Surf your city. Own your streets.',
  'Walk it. Run it. Ride it. Own it.',
  'Every street you cover becomes yours.',
] as const;
/** Privacy is part of the brand. */
export const PRIVACY_LINE = 'Your routes stay on your phone.';
export const TAGLINE = TAGLINES[0];
/** Strength tier names as users see them (ubiquitous language, `docs/poc-plan.md` §2). */
export const TIER_LABEL = { faint: 'Faint', glowing: 'Glowing', strong: 'Strong', blazing: 'Blazing' } as const;
/** Heading of the turf strength legend. */
export const TURF_LEGEND_TITLE = 'Turf strength';
export const PROMO = 'Walk, run or ride — every street you cover becomes your turf. Come back and watch it glow.';
