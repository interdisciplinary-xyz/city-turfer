import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { distanceText, formatDate, formatDuration, formatPaceOrSpeed } from '@/ui-kit/format';
import { TYPE_COLOR, TYPE_GLYPH, usePalette } from '@/ui-kit/theme';

import type { ActivityListItem } from '../contract';

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
        <Text style={{ color: p.muted, textAlign: 'center', marginTop: 40 }}>
          No activities yet. Record your first walk!
        </Text>
      }
      renderItem={({ item, index }) => {
        const pace = formatPaceOrSpeed(item.type, item.distanceM, item.movingS);
        return (
          <Pressable
            testID={`history-item-${index}`}
            onPress={() => onOpen(item.id)}
            style={[s.row, { backgroundColor: p.card, borderColor: p.border }]}
          >
            <View style={[s.badge, { backgroundColor: TYPE_COLOR[item.type] + '22' }]}>
              <Text style={s.glyph}>{TYPE_GLYPH[item.type]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.name, { color: p.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: p.muted, fontSize: 13 }}>{formatDate(item.startedAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.dist, { color: p.text }]}>{distanceText(item.distanceM)}</Text>
              <Text style={{ color: p.muted, fontSize: 13 }}>
                {formatDuration(item.movingS)} · {pace.value}
                {pace.unit}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 22 },
  name: { fontSize: 16, fontWeight: '700' },
  dist: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
