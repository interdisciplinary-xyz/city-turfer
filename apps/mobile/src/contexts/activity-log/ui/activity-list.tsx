import { FlatList, Text } from 'react-native';

import { usePalette } from '@/ui-kit/theme';

import type { ActivityListItem } from '../contract';
import { EMPTY_HISTORY_TEXT } from './activity-list.constants';
import { ActivityRow } from './activity-row';

export function ActivityList({
  items,
  onOpen,
  header,
}: {
  items: ActivityListItem[];
  onOpen: (id: string) => void;
  header?: React.ReactElement;
}) {
  const p = usePalette();
  return (
    <FlatList
      data={items}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={
        <Text style={{ color: p.muted, textAlign: 'center', marginTop: 40 }}>{EMPTY_HISTORY_TEXT}</Text>
      }
      renderItem={({ item, index }) => (
        <ActivityRow item={item} testID={`history-item-${index}`} onPress={() => onOpen(item.id)} />
      )}
    />
  );
}
