import { router } from 'expo-router';
import { View } from 'react-native';

import { ActivityList } from '@/contexts/activity-log/ui/activity-list';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { usePalette } from '@/ui-kit/theme';

/** Full activity history, pushed from Dashboard ("See all") and Stats. */
export default function HistoryScreen() {
  const p = usePalette();
  const items = useActivities();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ActivityList items={items ?? []} onOpen={(id) => router.push(`/activity/${id}`)} />
    </View>
  );
}
