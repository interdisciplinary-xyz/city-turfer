import {
  FONT_SIZE,
  FONT_WEIGHT,
  LABEL_TRACKING,
  RADIUS,
  SPACE,
  TIER_COLOR,
  TIER_LABEL,
  TIER_ORDER,
  TURF_LEGEND_TITLE,
} from '@cityturfer/brand';
import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/theme';
import { BAR_HEIGHT, type TurfLegendProps } from './turf-legend.constants';

/**
 * Explains the turf colours: the strength tiers from weakest to strongest, left to right, as a
 * stepped Ramp (no gradient: that would need a native module). Not on any app screen yet.
 */
export function TurfLegend({
  title = TURF_LEGEND_TITLE,
  labels = TIER_LABEL,
  compact,
  style,
  testID,
}: TurfLegendProps) {
  const p = usePalette();
  const summary = `${title}: ${TIER_ORDER.map((t) => labels[t]).join(', ')}, from weakest to strongest`;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={summary}
      style={[s.box, { backgroundColor: p.card, borderColor: p.border }, style]}
    >
      {compact ? null : <Text style={[s.title, { color: p.muted }]}>{title}</Text>}
      <View style={s.bar}>
        {TIER_ORDER.map((tier) => (
          <View key={tier} style={[s.step, { backgroundColor: TIER_COLOR[tier] }]} />
        ))}
      </View>
      {compact ? null : (
        <View style={s.labels}>
          {TIER_ORDER.map((tier) => (
            <Text key={tier} style={[s.label, { color: p.text }]} numberOfLines={1}>
              {labels[tier]}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderRadius: RADIUS.chip,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.md,
    gap: SPACE.sm,
  },
  title: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: LABEL_TRACKING,
  },
  bar: { flexDirection: 'row', height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, overflow: 'hidden', gap: 2 },
  step: { flex: 1 },
  labels: { flexDirection: 'row' },
  label: { flex: 1, textAlign: 'center', fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold },
});
