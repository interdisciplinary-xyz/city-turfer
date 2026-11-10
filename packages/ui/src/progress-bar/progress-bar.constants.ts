import type { ViewStyle } from 'react-native';

export type ProgressBarProps = {
  /** Share done, 0…1 (clamped): more than the target still shows a full bar. */
  progress: number;
  /** What a screen reader says, e.g. "20 of 30 minutes today"; the percentage goes in the value. */
  accessibilityLabel?: string;
  style?: ViewStyle;
  testID?: string;
};

/** Height of the bar in points. */
export const PROGRESS_BAR_HEIGHT = 8;
