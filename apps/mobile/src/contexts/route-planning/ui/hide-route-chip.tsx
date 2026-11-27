import { FONT_WEIGHT, RADIUS } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useT } from '@/i18n';
import { AppSymbol } from '@/ui-kit/symbol';
import { usePalette } from '@/ui-kit/theme';

import type { HideRouteChipProps } from './planner-view.constants';

/** On the Record map while the Planned Route is its guide line: takes the guide off (the plan stays). */
export function HideRouteChip({ onHide }: HideRouteChipProps) {
  const p = usePalette();
  const t = useT('planner');
  return (
    <Pressable
      testID='record-hide-route'
      accessibilityRole='button'
      accessibilityLabel={t('hideRouteLabel')}
      onPress={onHide}
      hitSlop={6}
      style={[s.chip, { backgroundColor: p.card }]}
    >
      <AppSymbol name='eye.slash' fallback='✕' size={15} color={p.text} />
      <Text style={{ color: p.text, fontWeight: FONT_WEIGHT.bold }}>{t('hideRoute')}</Text>
    </Pressable>
  );
}

// The Record map's chip look (record-view.tsx), so the column reads as one set.
const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.panel,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});
