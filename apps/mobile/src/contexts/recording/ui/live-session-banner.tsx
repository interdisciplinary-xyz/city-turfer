import { RADIUS } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TYPE_LABEL } from '@/constants/activity';
import { ACCENT, ON_ACCENT } from '@/constants/colors';
import { distanceText } from '@/ui-kit/format';

import type { LiveSnapshot } from '../domain/recording-session';

/** Shown outside the Record tab while a Recording Session is active (pass `useLiveSession()`). */
export function LiveSessionBanner({ live, onPress }: { live: LiveSnapshot | null; onPress: () => void }) {
  if (!live) {
    return null;
  }
  const state = live.status === 'recording' ? 'Recording' : 'Paused';
  return (
    <Pressable
      testID='live-session-banner'
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={`${state} ${TYPE_LABEL[live.type]}, ${distanceText(live.distanceM)}. Open Record.`}
      style={s.banner}
    >
      <View style={s.dot} />
      <Text style={s.text}>
        {state} {TYPE_LABEL[live.type].toLowerCase()} · <Text style={s.num}>{distanceText(live.distanceM)}</Text>
      </Text>
      <Text style={s.text}>Open ›</Text>
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
