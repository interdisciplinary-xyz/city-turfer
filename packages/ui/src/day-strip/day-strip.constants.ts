import type { ViewStyle } from 'react-native';

export type DayStripDay = {
  /** Stable React key, e.g. the day as 'YYYY-MM-DD'. */
  key: string;
  /** Short name under the column, already in the app language ("Mon", "pon."). */
  label: string;
  /** Share of the day's target done, 0…1 (clamped). */
  progress: number;
  /** Target reached: a full column with a check mark (never colour alone). */
  met: boolean;
  /** No target that day (before it was set, or turned off): a quiet outline only. */
  noTarget?: boolean;
  /** Today: the label is bold in the text colour. */
  current?: boolean;
  /** The whole day for a screen reader, units spelled out ("Monday: 20 of 30 minutes"). */
  accessibilityLabel: string;
  testID?: string;
};

export type DayStripProps = {
  /** Oldest first; today last. */
  days: DayStripDay[];
  style?: ViewStyle;
  testID?: string;
};

/** Height of a day's column in points. */
export const DAY_COLUMN_HEIGHT = 40;
/** Width of the column outline in points (3:1 against the card through `borderControl`). */
export const DAY_OUTLINE_WIDTH = 1.5;
/** The mark on a met day (a glyph, so the state never rests on colour alone). */
export const MET_MARK = '✓';
