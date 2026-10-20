import { type SFSymbol, SymbolView } from 'expo-symbols';
import { Text } from 'react-native';

import { type ActivityTypeName, TYPE_GLYPH, TYPE_SYMBOL } from '@/constants/activity';

/**
 * An SF Symbol (brand-system: icons), with a text glyph where SF Symbols don't exist (Android).
 * Outline by default; pass the `.fill` name for a selected state. Decorative: the control around it
 * carries the accessibility label.
 */
export function AppSymbol({
  name,
  fallback,
  size,
  color,
}: {
  name: string;
  fallback: string;
  size: number;
  color: string;
}) {
  return (
    <SymbolView
      name={name as SFSymbol}
      size={size}
      tintColor={color}
      accessible={false}
      importantForAccessibility='no'
      fallback={
        <Text accessible={false} style={{ color, fontSize: size }}>
          {fallback}
        </Text>
      }
    />
  );
}

/** The activity type's symbol (figure.walk, figure.run, bicycle); the emoji on Android. */
export function ActivitySymbol({ type, size, color }: { type: ActivityTypeName; size: number; color: string }) {
  return <AppSymbol name={TYPE_SYMBOL[type]} fallback={TYPE_GLYPH[type]} size={size} color={color} />;
}
