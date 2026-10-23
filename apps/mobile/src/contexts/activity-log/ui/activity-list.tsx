import { FlatList, Text } from 'react-native';

import { useLocale, useT } from '@/i18n';
import { usePalette } from '@/ui-kit/theme';

import type { ActivityListItem } from '../contract';
import { EMPTY_HISTORY_KEY } from './activity-list.constants';
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
  const t = useT('activity');
  // Rows format dates and numbers: re-render them when the language changes.
  const locale = useLocale();
  return (
    <FlatList
      data={items}
      extraData={locale}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={
        <Text style={{ color: p.muted, textAlign: 'center', marginTop: 40 }}>{t(EMPTY_HISTORY_KEY)}</Text>
      }
      renderItem={({ item, index }) => (
        <ActivityRow item={item} testID={`history-item-${index}`} onPress={() => onOpen(item.id)} />
      )}
    />
  );
}
