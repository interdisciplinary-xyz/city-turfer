import { type SFSymbol, SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ACCENT, TIER_COLOR } from '@/constants/colors';
import { type Achievement, type AchievementId, evaluateAchievements } from '@/contexts/achievements';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { useTurfSummary } from '@/contexts/territory/ui/hooks';
import { Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

const SYMBOL: Record<AchievementId, SFSymbol> = {
  'first-steps': 'figure.walk',
  'all-rounder': 'star.circle',
  'five-k': 'flag',
  'half-marathon': 'figure.run',
  'half-century-ride': 'bicycle',
  'hundred-km': 'flag.checkered',
  regular: 'calendar',
  'early-bird': 'sunrise',
  'night-owl': 'moon.stars',
  neighbourhood: 'hexagon',
  'turf-lord': 'crown',
  stronghold: 'shield.lefthalf.filled',
};

const progressText = (a: Achievement) =>
  a.unlocked ? 'Unlocked' : a.unit ? `${a.current} / ${a.target} ${a.unit}` : 'Not yet';

/** Composes Activity Log and Territory facts into the Achievements evaluation. */
export default function AchievementsScreen() {
  const p = usePalette();
  const activities = useActivities();
  const summary = useTurfSummary();
  const list = useMemo(
    () =>
      evaluateAchievements({
        activities: activities ?? [],
        turfCells: summary?.cellCount ?? 0,
        strongCells: summary?.strongCells ?? 0,
      }),
    [activities, summary]
  );
  const unlocked = list.filter((a) => a.unlocked).length;

  return (
    <FlatList
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={list}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <Text testID='achievements-count' style={[s.count, { color: p.muted }]}>
          {unlocked} of {list.length} unlocked
        </Text>
      }
      renderItem={({ item: a }) => {
        const color = a.unlocked ? TIER_COLOR.strong : p.muted;
        return (
          <Card style={a.unlocked ? s.row : { ...s.row, opacity: 0.85 }}>
            <View
              testID={`achievement-${a.id}`}
              accessible
              accessibilityLabel={`${a.title}. ${a.description} ${progressText(a)}`}
              style={[s.badge, { backgroundColor: a.unlocked ? `${TIER_COLOR.strong}22` : p.bg }]}
            >
              <SymbolView
                name={SYMBOL[a.id]}
                tintColor={color}
                size={26}
                fallback={<Text style={{ fontSize: 22, color }}>★</Text>}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.title, { color: p.text }]}>{a.title}</Text>
              <Text style={{ color: p.muted, fontSize: 13 }}>{a.description}</Text>
              <View style={[s.track, { backgroundColor: p.border }]}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${(a.current / a.target) * 100}%`,
                      backgroundColor: a.unlocked ? TIER_COLOR.strong : ACCENT,
                    },
                  ]}
                />
              </View>
              <Text style={[s.progress, { color: a.unlocked ? p.text : p.muted }]}>{progressText(a)}</Text>
            </View>
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  count: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
  progress: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
