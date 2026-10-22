import type { ViewStyle } from 'react-native';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  /** Fill colour; defaults to the accent (`glow`). */
  color?: string;
  /** Label and spinner colour; defaults to the palette's `onAccent` (white on dark, night on light). */
  textColor?: string;
  disabled?: boolean;
  /** Shows a spinner instead of the label and blocks presses. */
  busy?: boolean;
  testID?: string;
  style?: ViewStyle;
};

/** Opacity of a disabled button and of a button while pressed. */
export const DISABLED_OPACITY = 0.4;
export const PRESSED_OPACITY = 0.8;
