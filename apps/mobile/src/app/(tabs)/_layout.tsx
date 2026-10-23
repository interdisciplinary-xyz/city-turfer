import { Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import { type ColorValue, Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, ON_ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { MeTabButton } from '@/ui-kit/me-menu';
import { usePalette } from '@/ui-kit/theme';

/** SF Symbol on iOS (the `.fill` variant when focused); the text glyph is the fallback elsewhere (Android). */
const icon =
  (symbol: SFSymbol, filled: SFSymbol, glyph: string) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <SymbolView
      name={focused ? filled : symbol}
      type='monochrome'
      weight={focused ? 'semibold' : 'regular'}
      tintColor={color}
      size={24}
      fallback={<Text style={{ fontSize: 20, color }}>{glyph}</Text>}
    />
  );

/** The raised round Record button in the middle of the tab bar. */
function RecordTabButton({ onPress, onLongPress, testID, 'aria-selected': selected }: BottomTabBarButtonProps) {
  const p = usePalette();
  const t = useT('nav');
  const focused = !!selected;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel={t('tabs.record')}
      accessibilityState={{ selected: focused }}
      style={s.recordSlot}
    >
      <View style={[s.recordCircle, { borderColor: p.card }]}>
        <SymbolView
          name='record.circle'
          weight='semibold'
          tintColor={ON_ACCENT}
          size={30}
          fallback={<Text style={{ fontSize: 26, color: ON_ACCENT }}>●</Text>}
        />
      </View>
      <Text style={[s.recordLabel, { color: focused ? ACCENT : p.muted }]}>{t('tabs.record')}</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const p = usePalette();
  const t = useT('nav');
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: p.muted,
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: icon('house', 'house.fill', '⌂'),
          tabBarButtonTestID: 'tab-dashboard',
        }}
      />
      <Tabs.Screen
        name='turf'
        options={{
          title: t('tabs.turf'),
          tabBarIcon: icon('hexagon', 'hexagon.fill', '⬢'),
          tabBarButtonTestID: 'tab-turf',
        }}
      />
      <Tabs.Screen
        name='record'
        options={{ title: t('tabs.record'), tabBarButton: RecordTabButton, tabBarButtonTestID: 'tab-record' }}
      />
      <Tabs.Screen
        name='stats'
        options={{
          title: t('tabs.stats'),
          tabBarIcon: icon('chart.bar', 'chart.bar.fill', '▤'),
          tabBarButtonTestID: 'tab-stats',
        }}
      />
      <Tabs.Screen
        name='me'
        options={{
          title: t('tabs.me'),
          tabBarButton: ({ testID }) => <MeTabButton testID={testID} />,
          tabBarButtonTestID: 'tab-me',
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  recordSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  recordCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: -30,
    borderWidth: 4,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  recordLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
