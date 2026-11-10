import { APP_SCHEME, cssVariables, TIER_ORDER } from '@cityturfer/brand';
import type { CSSProperties } from 'react';

import data from './turf-demo.data.json';

export type TurfTier = (typeof TIER_ORDER)[number];

/** apps/web/tools/gen-turf-demo.mjs output: view-box pixels, built from the Gdańsk demo history. */
export type TurfDemoData = {
  view: { width: number; height: number };
  /** The fewest visits that reach each tier (the territory strength formula). */
  visitsPerTier: Record<TurfTier, number>;
  street: {
    /** The one street of beat 1: each cell a flat [x0, y0, x1, y1, …] polygon. */
    cells: number[][];
    /** Other demo cells around it, drawn dim. */
    context: number[][];
    /** Demo route lines through the view, flat [x, y, …]. */
    lines: number[][];
  };
  /** Beat 2: cell centres per tier, flat [x, y, …], drawn as dots of `radius`. */
  city: { radius: number } & Record<TurfTier, number[]>;
  totals: { activities: number; cells: number; areaKm2: number };
  /** How many achievements the app has (core's list), for the highlights copy. */
  achievements: number;
};

export const TURF_DEMO = data as TurfDemoData;

/** The demo is a night panel in the app's dark scheme (APP_SCHEME) on the light page. */
export const DEMO_SCHEME_STYLE = cssVariables(APP_SCHEME) as CSSProperties;

/** The four tiers on one street (steps 0–3); step 4 is the whole city (turf-demo-player.constants). */
export const DEMO_TIERS: readonly TurfTier[] = TIER_ORDER;
