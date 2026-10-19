import type { TierName } from '@cityturfer/brand';
import type { ViewStyle } from 'react-native';

export type TurfLegendProps = {
  /** Heading; defaults to the brand copy ("Turf strength"). */
  title?: string;
  /** Tier names; default to the brand copy. Pass translations here. */
  labels?: Record<TierName, string>;
  /** One line with the swatches only, for tight spots (map overlay). */
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
};

/** Height of the ramp bar in points. */
export const BAR_HEIGHT = 8;
