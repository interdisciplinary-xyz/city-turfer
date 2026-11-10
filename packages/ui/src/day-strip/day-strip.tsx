import { ACCENT, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/theme';
import { DAY_COLUMN_HEIGHT, DAY_OUTLINE_WIDTH, type DayStripProps, MET_MARK } from './day-strip.constants';

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * A row of days, each a column filled from the bottom by its share of the target: accent fill,
 * `borderControl` outline when empty, a check mark when met, a dashed `borderControl` outline on a
 * day without a target (the dash, not a fainter colour, keeps it quiet and visible at 3:1). Plain Views (no SVG); each day is one element for a screen reader.
 */
export function DayStrip({ days, style, testID }: DayStripProps) {
  const p = usePalette();
  return (
    <View testID={testID} style={[s.row, style]}>
      {days.map((d) => {
        const share = d.met ? 1 : clamp01(d.progress);
        return (
          <View key={d.key} testID={d.testID} accessible accessibilityLabel={d.accessibilityLabel} style={s.day}>
            <View
              style={[
                s.column,
                {
                  borderColor: d.met ? ACCENT : p.borderControl,
                  borderStyle: d.noTarget ? 'dashed' : 'solid',
                },
              ]}
            >
              {share > 0 ? <View style={[s.fill, { height: `${share * 100}%` }]} /> : null}
              {d.met ? <Text style={[s.mark, { color: p.onAccent }]}>{MET_MARK}</Text> : null}
            </View>
            <Text
              numberOfLines={1}
              style={[
                s.label,
                d.current
                  ? { color: p.text, fontWeight: FONT_WEIGHT.heavy }
                  : { color: p.muted, fontWeight: FONT_WEIGHT.semibold },
              ]}
            >
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.sm },
  day: { flex: 1, alignItems: 'stretch', gap: SPACE.xs },
  column: {
    height: DAY_COLUMN_HEIGHT,
    borderRadius: RADIUS.sm,
    borderWidth: DAY_OUTLINE_WIDTH,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: ACCENT },
  mark: {
    alignSelf: 'center',
    marginBottom: SPACE.sm,
    fontSize: FONT_SIZE.unit,
    fontWeight: FONT_WEIGHT.black,
  },
  label: { textAlign: 'center', fontSize: FONT_SIZE.label },
});
