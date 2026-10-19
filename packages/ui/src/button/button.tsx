import { ACCENT, FONT_SIZE, FONT_WEIGHT, ON_ACCENT, RADIUS, SPACE } from '@cityturfer/brand';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { type ButtonProps, DISABLED_OPACITY, PRESSED_OPACITY } from './button.constants';

/** Full-width call to action. The label doubles as the accessibility label. */
export function Button({
  label,
  onPress,
  color = ACCENT,
  textColor = ON_ACCENT,
  disabled,
  busy,
  testID,
  style,
}: ButtonProps) {
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
      {busy ? <ActivityIndicator color={textColor} /> : <Text style={[s.label, { color: textColor }]}>{label}</Text>}
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
