import { SPACE } from '@cityturfer/brand';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { ActivityDetailView } from '@/contexts/activity-log/ui/activity-detail-view';
import { useActivity } from '@/contexts/activity-log/ui/hooks';
import { RenameActivityDialog } from '@/contexts/activity-log/ui/rename-activity-dialog';
import { RENAME_ACTION } from '@/contexts/activity-log/ui/rename-activity-dialog.constants';
import { isImportedFromHealth } from '@/contexts/health-sync';
import { useClaim } from '@/contexts/territory/ui/hooks';
import { ClaimLayers } from '@/contexts/territory/ui/layers';
import { TurfGainedCard } from '@/contexts/territory/ui/turf-gained-card';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

/** Composes Activity Log (the activity) with Territory (the turf it claimed). */
export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { detail, remove, rename } = useActivity(id);
  const claim = useClaim(id);
  const [renaming, setRenaming] = useState(false);

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
        {isImportedFromHealth(detail.id) && (
          <Text testID='from-apple-health' style={{ color: p.muted, textAlign: 'center' }}>
            From Apple Health
          </Text>
        )}
        <TurfGainedCard claim={claim} />
        <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
          <Button
            testID='rename-activity'
            label={RENAME_ACTION}
            color={p.card}
            textColor={p.text}
            onPress={() => setRenaming(true)}
            style={{ flex: 1 }}
          />
          <Button
            testID='delete-activity'
            label='Delete activity'
            color={p.card}
            textColor={p.danger}
            style={{ flex: 1 }}
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
        </View>
      </ActivityDetailView>
      <RenameActivityDialog visible={renaming} name={detail.name} onClose={() => setRenaming(false)} onSave={rename} />
    </>
  );
}
