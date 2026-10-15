import { Tabs } from 'expo-router';
import { type ColorValue, Text } from 'react-native';

import { ACCENT, usePalette } from '@/ui-kit/theme';

const icon =
  (glyph: string) =>
  ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border },
      }}
    >
      <Tabs.Screen
        name='index'
        options={{ title: 'Record', tabBarIcon: icon('●'), tabBarButtonTestID: 'tab-record' }}
      />
      <Tabs.Screen name='turf' options={{ title: 'Turf', tabBarIcon: icon('⬢'), tabBarButtonTestID: 'tab-turf' }} />
      <Tabs.Screen
        name='history'
        options={{ title: 'History', tabBarIcon: icon('☰'), tabBarButtonTestID: 'tab-history' }}
      />
      <Tabs.Screen name='me' options={{ title: 'Me', tabBarIcon: icon('◉'), tabBarButtonTestID: 'tab-me' }} />
    </Tabs>
  );
}
