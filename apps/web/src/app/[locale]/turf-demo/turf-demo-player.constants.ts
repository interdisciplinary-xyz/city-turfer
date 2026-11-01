import { TIER_ORDER } from '@cityturfer/brand';
import type { CSSProperties, ReactNode } from 'react';

// The client player's constants, kept apart from turf-demo.constants.ts: that file imports the demo
// data, which would otherwise ship in the player's JavaScript as well as in the HTML.

/** Steps 0–3 are the tiers on one street; this last step is the whole city. */
export const CITY_STEP = TIER_ORDER.length;

/** Time per step while the demo plays (the brand's glow-up is 600–900 ms, plus a beat to read). */
export const STEP_MS = 1300;

/** Labels the player shows, translated on the server. */
export type TurfDemoLabels = {
  steps: string[];
  stepsLabel: string;
  replay: string;
};

export type TurfDemoPlayerProps = {
  labels: TurfDemoLabels;
  /** The app's dark scheme as inline variables: the panel and the step swatches (tiers glow on night). */
  schemeStyle: CSSProperties;
  /** Title and lede, above the step buttons. */
  head: ReactNode;
  /** The example-data caption, under the step buttons. */
  caption: ReactNode;
  /** The map, in the night panel. */
  children: ReactNode;
};
