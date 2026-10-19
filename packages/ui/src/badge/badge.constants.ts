import type { ReactNode } from 'react';
import type { AccessibilityProps } from 'react-native';

export type BadgeProps = AccessibilityProps & {
  /** A glyph (emoji or symbol character), or `children` for an icon the app renders. */
  glyph?: string;
  children?: ReactNode;
  /** Background fill, usually a brand colour at low alpha (see `tint()`). */
  tint: string;
  /** Diameter in points. */
  size?: number;
  testID?: string;
};

/** Diameter of an activity badge (History rows); achievements use 52. */
export const BADGE_SIZE = 44;
/** Hex alpha suffix for a badge background: a brand colour at ~13% opacity. */
export const TINT_ALPHA = '22';
