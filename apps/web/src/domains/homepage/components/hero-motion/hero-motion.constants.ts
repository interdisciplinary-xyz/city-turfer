import type { ReactNode } from 'react';

export type HeroMotionProps = {
  className?: string;
  children: ReactNode;
};

/** Brand motion: calm and glowing, never bouncy (`web-motion` skill). */
export const EASE = 'expo.out';

/** How far (px, at the window's edge) the hero's city map drifts against the pointer. */
export const MAP_DRIFT_PX = 20;
