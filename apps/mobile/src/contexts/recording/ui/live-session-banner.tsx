import { RADIUS } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, ON_ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { distanceText } from '@/ui-kit/format';

import type { LiveSnapshot } from '../domain/recording-session';

/** Shown outside the Record tab while a Recording Session is active (pass `useLiveSession()`). */
export function LiveSessionBanner({ live, onPress }: { live: LiveSnapshot | null; onPress: () => void }) {
  const t = useT('record');
  if (!live) {
    return null;
  }
  const values = {
    status: live.status === 'recording' ? 'recording' : 'paused',
    type: live.type,
    distance: distanceText(live.distanceM),
  };
  return (
    <Pressable
      testID='live-session-banner'
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={t('banner.label', values)}
      style={s.banner}
    >
      <View style={s.dot} />
      <Text style={s.text}>
        {t.rich('banner.text', { ...values, num: (chunks) => <Text style={s.num}>{chunks}</Text> })}
      </Text>
      <Text style={s.text}>{t('banner.open')}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: ACCENT,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ON_ACCENT },
  text: { color: ON_ACCENT, fontWeight: '800', fontSize: 15, flexShrink: 1 },
  num: { fontVariant: ['tabular-nums'] },
});
