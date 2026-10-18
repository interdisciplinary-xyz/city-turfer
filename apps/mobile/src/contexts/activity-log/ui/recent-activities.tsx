import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { usePalette } from '@/ui-kit/theme';

import type { ActivityListItem } from '../contract';
import { EMPTY_HISTORY_TEXT } from './activity-list';
import { ActivityRow } from './activity-row';

/** The latest few activities with a "See all" link to History (plain map: lives inside a ScrollView). */
export function RecentActivities({
  items,
  limit = 3,
  onOpen,
  onSeeAll,
}: {
  items: readonly ActivityListItem[];
  limit?: number;
  onOpen: (id: string) => void;
  onSeeAll: () => void;
}) {
  const p = usePalette();
  return (
    <View style={{ gap: 10 }}>
      <View style={s.header}>
        <Text style={[s.title, { color: p.text }]}>Recent activities</Text>
        {items.length > 0 && (
          <Pressable
            testID='dashboard-see-all-activities'
            onPress={onSeeAll}
            hitSlop={10}
            accessibilityRole='link'
            accessibilityLabel='See all activities'
          >
            <Text style={{ color: ACCENT, fontWeight: '700' }}>See all ›</Text>
          </Pressable>
        )}
      </View>
      {items.length === 0 ? (
        <Text style={{ color: p.muted }}>{EMPTY_HISTORY_TEXT}</Text>
      ) : (
        items
          .slice(0, limit)
          .map((a, i) => <ActivityRow key={a.id} item={a} testID={`recent-item-${i}`} onPress={() => onOpen(a.id)} />)
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800' },
});
