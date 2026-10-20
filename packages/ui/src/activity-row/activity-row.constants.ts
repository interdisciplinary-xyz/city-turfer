import type { BrandActivityType } from '@cityturfer/brand';
import type { ReactNode } from 'react';

/**
 * Presentational: every string arrives formatted. The Activity Log context maps its
 * `ActivityListItem` to these props (units and dates are formatted there, not here).
 */
export type ActivityRowProps = {
  type: BrandActivityType;
  /** Emoji for the activity type, shown in the badge when there is no `icon`. */
  glyph: string;
  /** The app's icon for the type (an SF Symbol), drawn in the badge instead of the glyph. */
  icon?: ReactNode;
  title: string;
  /** Date line under the title. */
  subtitle: string;
  /** Headline number on the right, e.g. "5.02 km" or "≈ 3.1 km". */
  value: string;
  /** Second line on the right, e.g. "28:14 · 5:37/km". */
  detail: string;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
};
