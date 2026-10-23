import { FONT_SIZE, SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACTIVITY_TYPES } from '@/constants/activity';
import { ACCENT, DISPLAY_CASE, DISPLAY_TRACKING, FONT_FAMILY, TYPE_COLOR } from '@/constants/colors';
import { activityStats } from '@/contexts/activity-log/ui/activity-stats';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { useTurfSummary } from '@/contexts/territory/ui/hooks';
import { useT } from '@/i18n';
import { Card, Stat } from '@/ui-kit/components';
import { distanceText, formatArea, formatDayMonth, formatDistance, formatDuration } from '@/ui-kit/format';
import { usePalette } from '@/ui-kit/theme';

/** Composes Activity Log (distance, time) and Territory (turf) totals. */
export default function StatsScreen() {
  const p = usePalette();
  const t = useT('stats');
  const tc = useT('common');
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
      contentContainerStyle={{ padding: SPACE.lg, paddingTop: insets.top + SPACE.lg, gap: 14 }}
    >
      <Text style={[s.h1, { color: p.text }]}>{t('title')}</Text>

      <Card style={{ gap: 12 }}>
        <Text style={[s.h2, { color: p.text }]}>{t('thisWeek')}</Text>
        <View style={{ flexDirection: 'row' }}>
          <Stat testID='week-distance' label={t('distance')} value={week.value} unit={week.unit} />
          <Stat label={t('time')} value={formatDuration(stats.thisWeek.movingS)} />
          <Stat label={t('activities')} value={String(stats.thisWeek.count)} />
        </View>
        <View style={s.bars} accessible accessibilityLabel={t('weeksChartLabel', { weeks: stats.weeks.length })}>
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
              <Text style={[s.barLabel, { color: p.muted }]}>{formatDayMonth(w.weekStart)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={[s.h2, { color: p.text }]}>{t('turf')}</Text>
        <View style={{ flexDirection: 'row' }}>
          <Stat label={t('area')} value={area[0]} unit={area[1]} />
          <Stat label={t('cells')} value={summary ? String(summary.cellCount) : '—'} />
          <Stat label={tc('tier.strong')} value={summary ? String(summary.strongCells) : '—'} />
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={[s.h2, { color: p.text }]}>{t('allTime')}</Text>
        {ACTIVITY_TYPES.map((type) => {
          const tot = stats.byType[type];
          const cells = summary ? summary.byType[type] : 0;
          return (
            <View key={type} style={s.row}>
              <View style={[s.dot, { backgroundColor: TYPE_COLOR[type] }]} />
              <Text style={[s.rowLabel, { color: p.text }]}>{tc(`activityType.${type}`)}</Text>
              <Text style={[s.rowValue, { color: p.muted }]}>
                {t('typeRow', {
                  count: String(tot.count),
                  distance: distanceText(tot.distanceM),
                  known: summary ? 'yes' : 'no',
                  cells,
                  cellsText: String(cells),
                })}
              </Text>
            </View>
          );
        })}
        <View style={[s.row, s.totalRow, { borderTopColor: p.border }]}>
          <Text style={[s.rowLabel, { color: p.text, marginLeft: 0 }]}>{t('total')}</Text>
          <Text style={[s.rowValue, { color: p.text }]}>
            {t('totalRow', {
              count: String(stats.allTime.count),
              distance: distanceText(stats.allTime.distanceM),
              duration: formatDuration(stats.allTime.movingS),
            })}
          </Text>
        </View>
      </Card>
      <Pressable
        testID='stats-see-history'
        onPress={() => router.push('/history')}
        accessibilityRole='link'
        accessibilityLabel={t('seeAllLabel')}
      >
        <Card style={s.link}>
          <Text style={[s.h2, { color: p.text }]}>{t('allActivities')}</Text>
          <Text style={{ color: ACCENT, fontWeight: '700' }}>{t('seeAll')}</Text>
        </Card>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: {
    fontSize: 35,
    lineHeight: 38,
    fontFamily: FONT_FAMILY.display,
    textTransform: DISPLAY_CASE,
    letterSpacing: DISPLAY_TRACKING,
  },
  h2: { fontSize: 17, fontWeight: '800' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 104, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: FONT_SIZE.label, marginTop: 4, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center' },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { fontSize: 16, fontWeight: '700', marginLeft: 10, flex: 1 },
  rowValue: { fontSize: 14, fontVariant: ['tabular-nums'] },
});
