import { SPACE } from '@cityturfer/brand';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import {
  type Achievement,
  ACHIEVEMENT_GROUPS,
  type AchievementGroup,
  type AchievementId,
  evaluateAchievements,
} from '@/contexts/achievements';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { useTurfSummary } from '@/contexts/territory/ui/hooks';
import { Badge, Card, tint } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

const SYMBOL: Record<AchievementId, SFSymbol> = {
  'first-steps': 'figure.walk',
  'all-rounder': 'star.circle',
  'early-bird': 'sunrise',
  'night-owl': 'moon.stars',
  neighbourhood: 'hexagon',
  district: 'square.grid.3x3',
  'turf-lord': 'crown',
  'across-town': 'building.2',
  'first-glow': 'sparkle',
  stronghold: 'shield.lefthalf.filled',
  'home-ground': 'flame',
  regular: 'calendar',
  'four-weeks': 'calendar.badge.checkmark',
  'season-ticket': 'ticket',
  'five-k': 'flag',
  'ten-k': 'flag.2.crossed',
  'half-marathon': 'figure.run',
  'half-century-ride': 'bicycle',
  'hundred-km': 'flag.checkered',
  'five-hundred-km': 'medal',
};

const GROUP_TITLE: Record<AchievementGroup, string> = {
  firsts: 'Firsts',
  turf: 'New streets',
  glow: 'Coming back',
  habits: 'Getting out',
  distance: 'Distance',
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
  const sections = useMemo(
    () =>
      ACHIEVEMENT_GROUPS.map((group) => {
        const data = list.filter((a) => a.group === group);
        return { group, data, unlocked: data.filter((a) => a.unlocked).length };
      }),
    [list]
  );

  return (
    <SectionList
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: SPACE.lg, gap: 10 }}
      sections={sections}
      keyExtractor={(a) => a.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View
          testID={`achievements-group-${section.group}`}
          accessibilityRole='header'
          accessibilityLabel={`${GROUP_TITLE[section.group]}, ${section.unlocked} of ${section.data.length} unlocked`}
          style={s.groupHeader}
        >
          <Text style={[s.groupTitle, { color: p.text }]}>{GROUP_TITLE[section.group]}</Text>
          <Text style={[s.groupCount, { color: p.muted }]}>
            {section.unlocked} / {section.data.length}
          </Text>
        </View>
      )}
      ListHeaderComponent={
        <Text testID='achievements-count' style={[s.count, { color: p.muted }]}>
          {unlocked} of {list.length} unlocked
        </Text>
      }
      renderItem={({ item: a }) => {
        const color = a.unlocked ? ACCENT : p.muted;
        return (
          <Card style={a.unlocked ? s.row : { ...s.row, opacity: 0.85 }}>
            <Badge
              testID={`achievement-${a.id}`}
              accessible
              accessibilityLabel={`${a.title}. ${a.description} ${progressText(a)}`}
              size={52}
              tint={a.unlocked ? tint(ACCENT) : p.bg}
            >
              <SymbolView
                name={SYMBOL[a.id]}
                tintColor={color}
                size={26}
                fallback={<Text style={{ fontSize: 22, color }}>★</Text>}
              />
            </Badge>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.title, { color: p.text }]}>{a.title}</Text>
              <Text style={{ color: p.muted, fontSize: 13 }}>{a.description}</Text>
              <View style={[s.track, { backgroundColor: p.border }]}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${(a.current / a.target) * 100}%`,
                      backgroundColor: ACCENT,
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
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 },
  groupTitle: { fontSize: 15, fontWeight: '800' },
  groupCount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  count: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
  progress: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
