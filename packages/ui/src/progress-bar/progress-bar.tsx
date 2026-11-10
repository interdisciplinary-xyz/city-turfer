import { ACCENT } from '@cityturfer/brand';
import { StyleSheet, View } from 'react-native';

import { usePalette } from '../theme/theme';
import { PROGRESS_BAR_HEIGHT, type ProgressBarProps } from './progress-bar.constants';

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * Progress toward a target: an accent fill on a border-coloured track. The accent, never a turf
 * tier's meaning (ACCENT shares its hex with the glowing tier), never red: a part-filled bar is
 * progress, not a failure.
 */
export function ProgressBar({ progress, accessibilityLabel, style, testID }: ProgressBarProps) {
  const p = usePalette();
  const share = clamp01(progress);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole='progressbar'
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
      style={[s.track, { backgroundColor: p.border }, style]}
    >
      <View style={[s.fill, { width: `${share * 100}%` }]} />
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: PROGRESS_BAR_HEIGHT, borderRadius: PROGRESS_BAR_HEIGHT / 2, overflow: 'hidden' },
  fill: { height: PROGRESS_BAR_HEIGHT, borderRadius: PROGRESS_BAR_HEIGHT / 2, backgroundColor: ACCENT },
});
