import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { usePalette } from '@/ui-kit/theme';

import type { ActivityListItem } from '../contract';
import { EMPTY_HISTORY_KEY } from './activity-list.constants';
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
  const t = useT('activity');
  return (
    <View style={{ gap: 10 }}>
      <View style={s.header}>
        <Text style={[s.title, { color: p.text }]}>{t('recentTitle')}</Text>
        {items.length > 0 && (
          <Pressable
            testID='dashboard-see-all-activities'
            onPress={onSeeAll}
            hitSlop={10}
            accessibilityRole='link'
            accessibilityLabel={t('seeAllLabel')}
          >
            <Text style={{ color: ACCENT, fontWeight: '700' }}>{t('seeAll')}</Text>
          </Pressable>
        )}
      </View>
      {items.length === 0 ? (
        <Text style={{ color: p.muted }}>{t(EMPTY_HISTORY_KEY)}</Text>
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
