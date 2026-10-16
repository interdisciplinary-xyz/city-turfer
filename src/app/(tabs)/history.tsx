import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityList } from '@/contexts/activity-log/ui/activity-list';
import { useActivities } from '@/contexts/activity-log/ui/hooks';
import { usePalette } from '@/ui-kit/theme';

export default function HistoryScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const items = useActivities();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <ActivityList
        items={items ?? []}
        onOpen={(id) => router.push(`/activity/${id}`)}
        header={<Text style={{ color: p.text, fontSize: 30, fontWeight: '900', marginBottom: 6 }}>History</Text>}
      />
    </View>
  );
}
