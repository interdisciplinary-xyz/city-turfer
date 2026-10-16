import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { ActivityDetailView } from '@/contexts/activity-log/ui/ActivityDetailView';
import { useActivity } from '@/contexts/activity-log/ui/hooks';
import { useClaim } from '@/contexts/territory/ui/hooks';
import { ClaimLayers } from '@/contexts/territory/ui/layers';
import { TurfGainedCard } from '@/contexts/territory/ui/TurfGainedCard';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

/** Composes Activity Log (the activity) with Territory (the turf it claimed). */
export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { detail, remove } = useActivity(id);
  const claim = useClaim(id);

  if (detail === undefined || detail === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg, gap: 10 }}>
        <ActivityIndicator />
        <Text style={{ color: p.muted }}>{detail === null ? 'Saving your activity…' : 'Loading…'}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: detail.name }} />
      <ActivityDetailView a={detail} mapOverlay={<ClaimLayers claim={claim} />}>
        <TurfGainedCard claim={claim} />
        <Button
          testID='delete-activity'
          label='Delete activity'
          color={p.card}
          textColor={p.danger}
          onPress={() =>
            Alert.alert('Delete activity?', 'Its turf will be released too.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await remove();
                  router.back();
                },
              },
            ])
          }
        />
      </ActivityDetailView>
    </>
  );
}
