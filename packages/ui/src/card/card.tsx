import { RADIUS, SPACE } from '@cityturfer/brand';
import { StyleSheet, View } from 'react-native';

import { usePalette } from '../theme/theme';
import type { CardProps } from './card.constants';

/** Raised surface on the theme background, with a hairline border. */
export function Card({ children, style, testID }: CardProps) {
  const p = usePalette();
  return (
    <View testID={testID} style={[s.card, { backgroundColor: p.card, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: SPACE.lg, borderWidth: StyleSheet.hairlineWidth },
});
