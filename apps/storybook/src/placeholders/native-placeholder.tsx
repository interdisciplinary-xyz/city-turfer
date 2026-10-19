import { FONT_SIZE, FONT_WEIGHT, LABEL_TRACKING, RADIUS, SPACE } from '@cityturfer/brand';
import { usePalette } from '@cityturfer/ui';
import { StyleSheet, Text, View } from 'react-native';

import type { NativePlaceholderProps } from './native-placeholder.constants';

/**
 * Stands in for UI that needs a native module (MapLibre, GPS, HealthKit). Those never run in a
 * browser, so Storybook shows where they go instead of a fake.
 */
export function NativePlaceholder({ title, module, note, height = 240 }: NativePlaceholderProps) {
  const p = usePalette();
  return (
    <View
      accessible
      accessibilityLabel={`${title}: needs ${module}, not shown in Storybook`}
      style={[s.box, { height, borderColor: p.border, backgroundColor: p.card }]}
    >
      <Text style={[s.module, { color: p.muted }]}>Native · {module}</Text>
      <Text style={[s.title, { color: p.text }]}>{title}</Text>
      <Text style={[s.note, { color: p.muted }]}>{note}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xxl,
    gap: SPACE.sm,
  },
  module: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: LABEL_TRACKING,
  },
  title: { fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.heavy },
  note: { fontSize: FONT_SIZE.caption, textAlign: 'center', maxWidth: 360 },
});
