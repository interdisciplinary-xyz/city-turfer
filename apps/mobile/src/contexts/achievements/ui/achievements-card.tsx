import type { AchievementsSummary } from '@cityturfer/core/achievements';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, FONT_FAMILY } from '@/constants/colors';
import { useLocale, useT } from '@/i18n';
import { Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { achievementCopy } from './achievement-copy';

/** Dashboard teaser: unlocked count and the next achievement within reach. */
export function AchievementsCard({ summary, onPress }: { summary: AchievementsSummary; onPress: () => void }) {
  const p = usePalette();
  const t = useT('achievements');
  const locale = useLocale();
  const next = summary.closest ? achievementCopy(summary.closest, t, locale) : null;
  const closest = summary.closest;
  const counts = { unlocked: summary.unlocked, total: summary.total };
  return (
    <Pressable
      testID='dashboard-achievements'
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={next ? t('card.labelNext', { ...counts, next: next.title }) : t('card.label', counts)}
    >
      <Card style={{ gap: 10 }}>
        <View style={s.header}>
          <Text style={[s.title, { color: p.text }]}>{t('title')}</Text>
          <Text style={{ color: ACCENT, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] }}>
            {t('card.count', counts)}
          </Text>
        </View>
        {next && closest ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: p.muted, fontSize: 13 }}>
              {t.rich('card.next', {
                title: next.title,
                description: next.description,
                b: (chunks) => <Text style={{ color: p.text, fontWeight: '700' }}>{chunks}</Text>,
              })}
            </Text>
            <View style={[s.track, { backgroundColor: p.border }]}>
              <View style={[s.fill, { width: `${(closest.current / closest.target) * 100}%` }]} />
            </View>
          </View>
        ) : (
          <Text style={{ color: p.text, fontWeight: '700' }}>{t('card.allUnlocked')}</Text>
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
