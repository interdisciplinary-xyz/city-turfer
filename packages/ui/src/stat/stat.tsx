import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT, LABEL_TRACKING, SPACE } from '@cityturfer/brand';
import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/theme';
import type { StatProps } from './stat.constants';

/** A number with its unit and caption: tabular figures, Archivo ExtraBold (brand typography). */
export function Stat({ label, value, unit, big, testID }: StatProps) {
  const p = usePalette();
  return (
    <View style={s.stat} testID={testID} accessible accessibilityLabel={`${label} ${value} ${unit ?? ''}`}>
      <Text style={[s.value, { color: p.text, fontSize: big ? FONT_SIZE.hero : FONT_SIZE.stat }]}>
        {value}
        {unit ? <Text style={[s.unit, { color: p.muted }]}> {unit}</Text> : null}
      </Text>
      <Text style={[s.label, { color: p.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  stat: { alignItems: 'center', flex: 1 },
  value: { fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] },
  unit: { fontSize: FONT_SIZE.unit, fontWeight: FONT_WEIGHT.semibold },
  label: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'uppercase',
    letterSpacing: LABEL_TRACKING,
    marginTop: SPACE.xxs,
  },
});
