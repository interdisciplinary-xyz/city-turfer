import { FONT_SIZE, FONT_WEIGHT, LABEL_TRACKING, SPACE } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { usePalette } from '@/ui-kit/theme';

import type { SettingsRowProps } from './account-settings.constants';

/**
 * One row of Me › Account: an uppercase label over its value. With `onPress` it is a button with a
 * chevron (at least 56 pt tall); disabled rows keep their text readable but say why in the value.
 */
export function SettingsRow({ label, value, testID, onPress, disabled, accessibilityHint, divider }: SettingsRowProps) {
  const p = usePalette();
  const t = useT('account');
  const a11yLabel = t('rowLabel', { label, value });
  const body = (
    <View style={s.text}>
      <Text style={[s.key, { color: p.muted }]}>{label}</Text>
      <Text style={[s.value, { color: disabled ? p.muted : p.text }]}>{value}</Text>
    </View>
  );
  const line = divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border } : null;
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={a11yLabel} style={[s.row, line]}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel={a11yLabel}
      accessibilityHint={disabled ? undefined : accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.row, s.control, line, pressed && s.pressed]}
    >
      {body}
      {!disabled && (
        <Text style={[s.chevron, { color: p.muted }]} importantForAccessibility='no'>
          ›
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { paddingVertical: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  control: { minHeight: 56 },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: SPACE.xxs },
  key: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'uppercase',
    letterSpacing: LABEL_TRACKING,
  },
  value: { fontSize: FONT_SIZE.body },
  chevron: { fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.bold },
});
