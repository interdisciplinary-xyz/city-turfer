import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { activityStats } from '@/contexts/activity-log/ui/activityStats';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { useTurfSummary } from '@/contexts/territory/ui/hooks';
import { ACTIVITY_TYPES } from '@/shared-kernel';
import { Card, Stat } from '@/ui-kit/components';
import { distanceText, formatArea, formatDistance, formatDuration } from '@/ui-kit/format';
import { ACCENT, TYPE_COLOR, TYPE_LABEL, usePalette } from '@/ui-kit/theme';

/** Composes Activity Log (distance, time) and Territory (turf) totals. */
export default function StatsScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const activities = useActivities();
  const summary = useTurfSummary();
  const stats = useMemo(() => activityStats(activities ?? [], Date.now()), [activities]);
  const week = formatDistance(stats.thisWeek.distanceM);
  const area = summary ? formatArea(summary.areaKm2).split(' ') : ['—'];
  const maxWeek = Math.max(1, ...stats.weeks.map((w) => w.distanceM));

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 14 }}
    >
      <Text style={[s.h1, { color: p.text }]}>Stats</Text>

      <Card style={{ gap: 12 }}>
        <Text style={[s.h2, { color: p.text }]}>This week</Text>
        <View style={{ flexDirection: 'row' }}>
          <Stat testID='week-distance' label='Distance' value={week.value} unit={week.unit} />
          <Stat label='Time' value={formatDuration(stats.thisWeek.movingS)} />
          <Stat label='Activities' value={String(stats.thisWeek.count)} />
        </View>
        <View style={s.bars} accessible accessibilityLabel='Distance per week, last 8 weeks'>
          {stats.weeks.map((w, i) => (
            <View key={w.weekStart} style={s.barCol}>
              <View
                style={[
                  s.bar,
                  {
                    height: Math.max(3, (w.distanceM / maxWeek) * 80),
                    backgroundColor: i === stats.weeks.length - 1 ? ACCENT : p.border,
                  },
                ]}
              />
              <Text style={[s.barLabel, { color: p.muted }]}>
                {new Date(w.weekStart).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={[s.h2, { color: p.text }]}>Turf</Text>
        <View style={{ flexDirection: 'row' }}>
          <Stat label='Area' value={area[0]} unit={area[1]} />
          <Stat label='Cells' value={summary ? String(summary.cellCount) : '—'} />
          <Stat label='Strong' value={summary ? String(summary.strongCells) : '—'} />
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={[s.h2, { color: p.text }]}>All time</Text>
        {ACTIVITY_TYPES.map((t) => {
          const tot = stats.byType[t];
          return (
            <View key={t} style={s.row}>
              <View style={[s.dot, { backgroundColor: TYPE_COLOR[t] }]} />
              <Text style={[s.rowLabel, { color: p.text }]}>{TYPE_LABEL[t]}</Text>
              <Text style={[s.rowValue, { color: p.muted }]}>
                {tot.count} · {distanceText(tot.distanceM)} · {summary ? summary.byType[t] : '—'} cells
              </Text>
            </View>
          );
        })}
        <View style={[s.row, s.totalRow, { borderTopColor: p.border }]}>
          <Text style={[s.rowLabel, { color: p.text, marginLeft: 0 }]}>Total</Text>
          <Text style={[s.rowValue, { color: p.text }]}>
            {stats.allTime.count} · {distanceText(stats.allTime.distanceM)} · {formatDuration(stats.allTime.movingS)}
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '900' },
  h2: { fontSize: 17, fontWeight: '800' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 104, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 10, marginTop: 4, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center' },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { fontSize: 16, fontWeight: '700', marginLeft: 10, flex: 1 },
  rowValue: { fontSize: 14, fontVariant: ['tabular-nums'] },
});
