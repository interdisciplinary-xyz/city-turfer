import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACCENT, FONT_FAMILY } from '@/constants/colors';
import { evaluateAchievements, type OnboardingStepId, summarizeAchievements } from '@/contexts/achievements';
import { AchievementsCard } from '@/contexts/achievements/ui/achievements-card';
import { OnboardingCard } from '@/contexts/achievements/ui/onboarding-card';
import { useOnboarding } from '@/contexts/achievements/ui/use-onboarding';
import { activityStats } from '@/contexts/activity-log/ui/activity-stats';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { RecentActivities } from '@/contexts/activity-log/ui/recent-activities';
import { LiveSessionBanner } from '@/contexts/recording/ui/live-session-banner';
import { useLiveSession } from '@/contexts/recording/ui/use-live-session';
import { useTurfSummary } from '@/contexts/territory/ui/hooks';
import { useApp } from '@/ui-kit/app-context';
import { Button, Card, Stat } from '@/ui-kit/components';
import { formatArea, formatDistance, formatDuration } from '@/ui-kit/format';
import { usePalette } from '@/ui-kit/theme';

const ONBOARDING_ROUTE: Record<OnboardingStepId, '/record' | '/turf' | '/achievements'> = {
  'first-walk': '/record',
  'see-turf': '/turf',
  'try-all-three': '/record',
  'come-back': '/record',
  'unlock-three': '/achievements',
};

/** Start tab: composes Identity, Activity Log, Territory, Achievements and Recording. */
export default function DashboardScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { auth } = useApp();
  const name = auth.status === 'signed-in' ? auth.user.displayName : '';
  const activities = useActivities();
  const summary = useTurfSummary();
  const live = useLiveSession();
  // Recompute "this week" when the day changes, not only when data does (the tab stays mounted).
  const today = new Date().toDateString();
  const week = useMemo(() => activityStats(activities ?? [], Date.now()).thisWeek, [activities, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const achievements = useMemo(
    () =>
      summarizeAchievements(
        evaluateAchievements({
          activities: activities ?? [],
          turfCells: summary?.cellCount ?? 0,
          strongCells: summary?.strongCells ?? 0,
        })
      ),
    [activities, summary]
  );
  const onboardingFacts = useMemo(
    () =>
      activities && summary
        ? {
            activities,
            turfCells: summary.cellCount,
            strongCells: summary.strongCells,
            achievementsUnlocked: achievements.unlocked,
          }
        : null,
    [activities, summary, achievements]
  );
  const onboarding = useOnboarding(auth.status === 'signed-in' ? auth.user.id : null, onboardingFacts);
  const distance = formatDistance(week.distanceM);
  const empty = activities !== null && activities.length === 0;

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 40, gap: 14 }}
    >
      <LiveSessionBanner live={live} onPress={() => router.navigate('/record')} />
      <View style={{ gap: 4 }}>
        <Text testID='dashboard-greeting' style={[s.h1, { color: p.text }]}>
          Hello, {name}
        </Text>
        <Text style={{ color: p.muted }}>
          {empty
            ? 'Your turf starts with your first walk.'
            : summary
              ? `${formatArea(summary.areaKm2)} of turf · +${formatArea(summary.newThisWeekKm2)} this week`
              : ' '}
        </Text>
      </View>
      {onboarding.progress && (
        <OnboardingCard
          progress={onboarding.progress}
          onOpenStep={(id) => router.navigate(ONBOARDING_ROUTE[id])}
          onHide={onboarding.hide}
        />
      )}
      {empty && !live && (
        <Button
          testID='dashboard-start'
          label='Start recording'
          color={ACCENT}
          onPress={() => router.navigate('/record')}
        />
      )}
      <Card style={{ gap: 12 }}>
        <Text style={[s.h2, { color: p.text }]}>This week</Text>
        <View style={{ flexDirection: 'row' }}>
          <Stat testID='dashboard-week-distance' label='Distance' value={distance.value} unit={distance.unit} />
          <Stat label='Time' value={formatDuration(week.movingS)} />
          <Stat label='Activities' value={String(week.count)} />
        </View>
      </Card>
      {!empty && (
        <RecentActivities
          items={activities ?? []}
          onOpen={(id) => router.push(`/activity/${id}`)}
          onSeeAll={() => router.push('/history')}
        />
      )}
      <AchievementsCard summary={achievements} onPress={() => router.push('/achievements')} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 28, fontFamily: FONT_FAMILY.display, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: '800' },
});
