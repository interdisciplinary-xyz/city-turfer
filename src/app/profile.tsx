import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { evaluateAchievements } from '@/contexts/achievements';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { useTurfSummary } from '@/contexts/territory/ui/hooks';
import { useApp } from '@/ui-kit/app-context';
import { Card, Stat } from '@/ui-kit/components';
import { formatArea, formatDistance } from '@/ui-kit/format';
import { usePalette } from '@/ui-kit/theme';

export default function ProfileScreen() {
  const p = usePalette();
  const { auth } = useApp();
  const user = auth.status === 'signed-in' ? auth.user : null;
  const activities = useActivities();
  const summary = useTurfSummary();
  const totalM = (activities ?? []).reduce((m, a) => m + a.distanceM, 0);
  const total = formatDistance(totalM);
  const area = summary ? formatArea(summary.areaKm2).split(' ') : ['—'];
  const achievements = useMemo(
    () =>
      evaluateAchievements({
        activities: activities ?? [],
        turfCells: summary?.cellCount ?? 0,
        strongCells: summary?.strongCells ?? 0,
      }),
    [activities, summary]
  );
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const name = user?.displayName ?? 'You';

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.initial}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text testID='profile-name' style={[s.name, { color: p.text }]}>
          {name}
        </Text>
        <Text style={{ color: p.muted }}>{user?.email}</Text>
      </View>
      <Card>
        <View style={{ flexDirection: 'row' }}>
          <Stat label='Activities' value={String(activities?.length ?? '—')} />
          <Stat label='Distance' value={total.value} unit={total.unit} />
          <Stat label='Turf' value={area[0]} unit={area[1]} />
        </View>
      </Card>
      <Pressable testID='profile-achievements' onPress={() => router.push('/achievements')}>
        <Card style={s.link}>
          <Text style={[s.linkText, { color: p.text }]}>Achievements</Text>
          <Text style={{ color: ACCENT, fontWeight: '700' }}>
            {unlocked} / {achievements.length} ›
          </Text>
        </Card>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  initial: { color: '#FFFFFF', fontSize: 38, fontWeight: '900' },
  name: { fontSize: 26, fontWeight: '900' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkText: { fontSize: 17, fontWeight: '800' },
});
