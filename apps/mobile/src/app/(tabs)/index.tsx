import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACCENT, DISPLAY_CASE, DISPLAY_TRACKING, FONT_FAMILY } from '@/constants/colors';
import { evaluateAchievements, type OnboardingStepId, summarizeAchievements } from '@/contexts/achievements';
import { AchievementsCard } from '@/contexts/achievements/ui/achievements-card';
import { OnboardingCard } from '@/contexts/achievements/ui/onboarding-card';
import { useOnboarding } from '@/contexts/achievements/ui/use-onboarding';
import { activityStats } from '@/contexts/activity-log/ui/activity-stats';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { RecentActivities } from '@/contexts/activity-log/ui/recent-activities';
import { RestoreCard } from '@/contexts/cloud-backup/ui/restore-card';
import { useBackupLinkTarget } from '@/contexts/identity/ui/hooks';
import { LiveSessionBanner } from '@/contexts/recording/ui/live-session-banner';
import { useLiveSession } from '@/contexts/recording/ui/use-live-session';
import { useTurfSummary } from '@/contexts/territory/ui/hooks';
import { useT } from '@/i18n';
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
  const t = useT('dashboard');
  const ts = useT('stats');
  const { auth } = useApp();
  // The chosen name; without one, a friendly "Turfer" (never an id or the email).
  const name = auth.status === 'signed-in' ? auth.user.name : '';
  const activities = useActivities();
  const summary = useTurfSummary();
  const live = useLiveSession();
  // A linkable local profile restores after a code in Info, not a sign-in (the card's wording).
  const localProfile = useBackupLinkTarget() != null;
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
          {t('greeting', { hasName: name ? 'yes' : 'no', name: name ?? '' })}
        </Text>
        <Text style={{ color: p.muted }}>
          {empty
            ? t('emptySubtitle')
            : summary
              ? t('turfSubtitle', { area: formatArea(summary.areaKm2), newArea: formatArea(summary.newThisWeekKm2) })
              : ' '}
        </Text>
      </View>
      <RestoreCard localProfile={localProfile} />
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
          label={t('startRecording')}
          color={ACCENT}
          onPress={() => router.navigate('/record')}
        />
      )}
      <Card style={{ gap: 12 }}>
        <Text style={[s.h2, { color: p.text }]}>{ts('thisWeek')}</Text>
        <View style={{ flexDirection: 'row' }}>
          <Stat testID='dashboard-week-distance' label={ts('distance')} value={distance.value} unit={distance.unit} />
          <Stat label={ts('time')} value={formatDuration(week.movingS)} />
          <Stat label={ts('activities')} value={String(week.count)} />
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
  h1: {
    fontSize: 35,
    lineHeight: 38,
    fontFamily: FONT_FAMILY.display,
    textTransform: DISPLAY_CASE,
    letterSpacing: DISPLAY_TRACKING,
  },
  h2: { fontSize: 17, fontWeight: '800' },
});
