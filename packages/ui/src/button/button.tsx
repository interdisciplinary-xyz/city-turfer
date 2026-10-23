import { ACCENT, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/theme';
import { type ButtonProps, DISABLED_OPACITY, PRESSED_OPACITY } from './button.constants';

/**
 * Full-width call to action. The label doubles as the accessibility label. The default label
 * colour is the palette's `onAccent`: white in the app (dark), night on light surfaces.
 */
export function Button({ label, onPress, color = ACCENT, textColor, disabled, busy, testID, style }: ButtonProps) {
  const p = usePalette();
  const ink = textColor ?? p.onAccent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: color, opacity: disabled ? DISABLED_OPACITY : pressed ? PRESSED_OPACITY : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={ink} /> : <Text style={[s.label, { color: ink }]}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
  },
  label: { fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.bold },
});
