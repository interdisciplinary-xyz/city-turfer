import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { usePalette } from './theme';

export function Button({
  label,
  onPress,
  color,
  textColor = '#fff',
  disabled,
  busy,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  color: string;
  textColor?: string;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[s.buttonText, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Stat({
  label,
  value,
  unit,
  big,
  testID,
}: {
  label: string;
  value: string;
  unit?: string;
  big?: boolean;
  testID?: string;
}) {
  const p = usePalette();
  return (
    <View style={s.stat} testID={testID} accessible accessibilityLabel={`${label} ${value} ${unit ?? ''}`}>
      <Text style={[s.statValue, { color: p.text, fontSize: big ? 52 : 26 }]}>
        {value}
        {unit ? <Text style={[s.statUnit, { color: p.muted }]}> {unit}</Text> : null}
      </Text>
      <Text style={[s.statLabel, { color: p.muted }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return <View style={[s.card, { backgroundColor: p.card, borderColor: p.border }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  button: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { fontSize: 18, fontWeight: '700' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 15, fontWeight: '600' },
  statLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth },
});
