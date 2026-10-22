import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, tint } from '../badge/badge';
import { usePalette } from '../theme/theme';
import { type ActivityRowProps, TYPE_GRAPHIC_KEY } from './activity-row.constants';

/** One activity in a list (History, Dashboard): type badge, name and date, distance and pace. */
export function ActivityRow({
  type,
  glyph,
  icon,
  title,
  subtitle,
  value,
  detail,
  accessibilityLabel,
  onPress,
  testID,
}: ActivityRowProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel}
      style={[s.row, { backgroundColor: p.card, borderColor: p.border }]}
    >
      <Badge glyph={icon ? undefined : glyph} tint={tint(p[TYPE_GRAPHIC_KEY[type]])}>
        {icon}
      </Badge>
      <View style={s.main}>
        <Text style={[s.title, { color: p.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[s.small, { color: p.muted }]}>{subtitle}</Text>
      </View>
      <View style={s.end}>
        <Text style={[s.value, { color: p.text }]}>{value}</Text>
        <Text style={[s.small, { color: p.muted }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1 },
  end: { alignItems: 'flex-end' },
  title: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  small: { fontSize: FONT_SIZE.caption },
  value: { fontSize: FONT_SIZE.body, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] },
});
