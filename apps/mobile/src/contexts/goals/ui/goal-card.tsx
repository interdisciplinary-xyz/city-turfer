import { DISPLAY_CASE, DISPLAY_TRACKING, FONT_SIZE, FONT_WEIGHT, LABEL_TRACKING, SPACE } from '@cityturfer/brand';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, FONT_FAMILY } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button, Card, DayStrip, ProgressBar } from '@/ui-kit/components';
import { AppSymbol } from '@/ui-kit/symbol';
import { usePalette } from '@/ui-kit/theme';

import { goalStreak } from '../index';
import { type GoalCardProps, STREAK_FLAME_IDLE_SIZE, STREAK_FLAME_SIZE } from './goal-card.constants';
import { minutesOf, shareOf, stripDays } from './goal-days';

/**
 * Start tab: the Daily goal. Without a goal, an offer to set one (hideable); with one, today's
 * minutes against it, a bar and the last 7 days. A day under the goal is a partly filled day:
 * no red, no "missed".
 */
export function GoalCard({ view, onSet, onHide, onChange }: GoalCardProps) {
  const p = usePalette();
  const t = useT('goals');
  if (view.goalMinutes == null) {
    if (view.offerHidden) {
      return null;
    }
    return (
      <Card>
        <View testID='goal-card' style={s.body}>
          <View testID='goal-offer' style={s.header}>
            <Text accessibilityRole='header' style={[s.title, { color: p.text }]}>
              {t('offer.title')}
            </Text>
            <Pressable
              testID='goal-offer-hide'
              onPress={onHide}
              hitSlop={12}
              accessibilityRole='button'
              accessibilityLabel={t('offer.hideLabel')}
              style={s.link}
            >
              <Text style={[s.linkText, { color: p.muted }]}>{t('offer.hide')}</Text>
            </Pressable>
          </View>
          <Text style={{ color: p.muted }}>{t('offer.body')}</Text>
          <Button testID='goal-offer-set' label={t('offer.set')} onPress={onSet} />
        </View>
      </Card>
    );
  }

  const goal = view.goalMinutes;
  const done = minutesOf(view.today.movingS);
  const left = Math.max(0, goal - done);
  const metDays = view.week.filter((d) => d.met).length;
  const streak = goalStreak(view);
  const streakHint = streak === 0 ? t('streakStart') : view.today.met ? null : t('streakKeep');
  const status = view.today.met ? t('met', { done }) : done === 0 ? t('empty') : t('toGo', { left });
  return (
    <Card>
      <View testID='goal-card' style={s.body}>
        <View style={s.header}>
          <Text accessibilityRole='header' style={[s.title, { color: p.text }]}>
            {t('title')}
          </Text>
          <Pressable
            testID='goal-edit'
            onPress={onChange}
            hitSlop={12}
            accessibilityRole='button'
            accessibilityLabel={t('changeLabel')}
            style={s.link}
          >
            <Text style={[s.linkText, { color: p.text }]}>{t('change')}</Text>
          </Pressable>
        </View>
        <View
          testID='goal-streak'
          accessible
          accessibilityLabel={[t('streakLabel', { count: streak }), streakHint].filter(Boolean).join('. ')}
          style={s.streak}
        >
          {/* Android draws the text fallback, which ignores colour: no full-colour flame for "no streak". */}
          {(streak > 0 || Platform.OS !== 'android') && (
            <AppSymbol
              name={streak > 0 ? 'flame.fill' : 'flame'}
              fallback='🔥'
              size={streak > 0 ? STREAK_FLAME_SIZE : STREAK_FLAME_IDLE_SIZE}
              color={streak > 0 ? ACCENT : p.borderControl}
            />
          )}
          <View style={s.streakText}>
            {streak > 0 && (
              <Text testID='goal-streak-days' style={[s.streakDays, { color: p.text }]}>
                {t('streak', { count: streak })}
              </Text>
            )}
            {streakHint && <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{streakHint}</Text>}
          </View>
        </View>
        <Text
          testID='goal-today'
          accessibilityLabel={t('progressLabel', { done, goal })}
          style={[s.figure, { color: p.text }]}
        >
          {t('progress', { done, goal })}
        </Text>
        <Text
          testID='goal-status'
          style={{ color: view.today.met ? p.text : p.muted, fontWeight: FONT_WEIGHT.semibold }}
        >
          {status}
        </Text>
        <ProgressBar progress={shareOf(view.today)} accessibilityLabel={t('title')} />
        <Text style={[s.label, { color: p.muted }]}>{t('weekTitle')}</Text>
        <DayStrip testID='goal-strip' days={stripDays(view.week, t)} />
        <Text testID='goal-week-summary' style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>
          {t('weekSummary', { count: metDays })}
        </Text>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  body: { gap: SPACE.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  title: { flex: 1, fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.heavy },
  link: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  linkText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  figure: { fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'], fontSize: FONT_SIZE.stat },
  streak: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  streakText: { flex: 1, gap: 2 },
  streakDays: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.stat,
    textTransform: DISPLAY_CASE,
    letterSpacing: DISPLAY_TRACKING,
  },
  label: {
    marginTop: SPACE.xs,
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: LABEL_TRACKING,
  },
});
