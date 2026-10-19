import { StyleSheet, Text, View } from 'react-native';

import { BADGE_SIZE, type BadgeProps, TINT_ALPHA } from './badge.constants';

/** `#RRGGBB` → `#RRGGBBAA` at the badge alpha: the tinted circle behind a glyph. */
export function tint(hex: string): string {
  return `${hex}${TINT_ALPHA}`;
}

/** A tinted circle holding a glyph or an icon (activity type, achievement). */
export function Badge({ glyph, children, tint: fill, size = BADGE_SIZE, testID, ...a11y }: BadgeProps) {
  return (
    <View
      testID={testID}
      {...a11y}
      style={[s.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]}
    >
      {glyph ? <Text style={{ fontSize: Math.round(size / 2) }}>{glyph}</Text> : children}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
