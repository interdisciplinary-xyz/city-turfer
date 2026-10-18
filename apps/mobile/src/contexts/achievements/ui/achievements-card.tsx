import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import type { AchievementsSummary } from '../domain/achievements-summary';

/** Dashboard teaser: unlocked count and the next achievement within reach. */
export function AchievementsCard({ summary, onPress }: { summary: AchievementsSummary; onPress: () => void }) {
  const p = usePalette();
  const next = summary.closest;
  return (
    <Pressable
      testID='dashboard-achievements'
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={`Achievements, ${summary.unlocked} of ${summary.total} unlocked${next ? `. Next up: ${next.title}` : ''}`}
    >
      <Card style={{ gap: 10 }}>
        <View style={s.header}>
          <Text style={[s.title, { color: p.text }]}>Achievements</Text>
          <Text style={{ color: ACCENT, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            {summary.unlocked} / {summary.total} ›
          </Text>
        </View>
        {next ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: p.muted, fontSize: 13 }}>
              Next up: <Text style={{ color: p.text, fontWeight: '700' }}>{next.title}</Text> · {next.description}
            </Text>
            <View style={[s.track, { backgroundColor: p.border }]}>
              <View style={[s.fill, { width: `${(next.current / next.target) * 100}%` }]} />
            </View>
          </View>
        ) : (
          <Text style={{ color: p.text, fontWeight: '700' }}>All unlocked. Legend.</Text>
        )}
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: ACCENT },
});
