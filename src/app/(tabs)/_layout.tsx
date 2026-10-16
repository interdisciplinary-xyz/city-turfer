import { Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import { type ColorValue, Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { MeTabButton } from '@/ui-kit/me-menu';
import { usePalette } from '@/ui-kit/theme';

/** SF Symbol on iOS; the text glyph is the fallback elsewhere (Android). */
const icon =
  (symbol: SFSymbol, glyph: string) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <SymbolView
      name={symbol}
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
  const focused = !!selected;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel='Record'
      accessibilityState={{ selected: focused }}
      style={s.recordSlot}
    >
      <View style={[s.recordCircle, { borderColor: p.card }]}>
        <SymbolView
          name='record.circle'
          weight='semibold'
          tintColor='#FFFFFF'
          size={30}
          fallback={<Text style={{ fontSize: 26, color: '#FFFFFF' }}>●</Text>}
        />
      </View>
      <Text style={[s.recordLabel, { color: focused ? ACCENT : p.muted }]}>Record</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      // Open on Record (centre) although Turf is the first tab.
      initialRouteName='index'
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: p.muted,
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name='turf'
        options={{ title: 'Turf', tabBarIcon: icon('hexagon', '⬢'), tabBarButtonTestID: 'tab-turf' }}
      />
      <Tabs.Screen
        name='stats'
        options={{ title: 'Stats', tabBarIcon: icon('chart.bar', '▤'), tabBarButtonTestID: 'tab-stats' }}
      />
      <Tabs.Screen
        name='index'
        options={{ title: 'Record', tabBarButton: RecordTabButton, tabBarButtonTestID: 'tab-record' }}
      />
      <Tabs.Screen
        name='history'
        options={{
          title: 'History',
          tabBarIcon: icon('clock.arrow.circlepath', '☰'),
          tabBarButtonTestID: 'tab-history',
        }}
      />
      <Tabs.Screen
        name='me'
        options={{
          title: 'Me',
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
