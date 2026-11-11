import { SPACE } from '@cityturfer/brand';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { ActivityDetailView } from '@/contexts/activity-log/ui/activity-detail-view';
import { useActivity } from '@/contexts/activity-log/ui/hooks';
import { RenameActivityDialog } from '@/contexts/activity-log/ui/rename-activity-dialog';
import { isImportedFromHealth } from '@/contexts/health-sync';
import type { PickedPhoto } from '@/contexts/share-photo';
import { pendingPhoto } from '@/contexts/share-photo/ui/pending-photo';
import { SharePhotoButton } from '@/contexts/share-photo/ui/share-photo-button';
import { SharePromptCard } from '@/contexts/share-photo/ui/share-prompt-card';
import { useClaim } from '@/contexts/territory/ui/hooks';
import { ClaimLayers } from '@/contexts/territory/ui/layers';
import { TurfGainedCard } from '@/contexts/territory/ui/turf-gained-card';
import { useT } from '@/i18n';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

/**
 * Composes Activity Log (the activity) with Territory (the turf it claimed) and Share Photo (the
 * button, and the "Share a photo?" card when opened straight from Finish: `justFinished=1`).
 */
export default function ActivityScreen() {
  const { id, justFinished } = useLocalSearchParams<{ id: string; justFinished?: string }>();
  const { auth } = useApp();
  const userId = auth.status === 'signed-in' ? auth.user.id : null;
  const p = usePalette();
  const t = useT('activity');
  const tc = useT('common');
  const { detail, remove, rename } = useActivity(id);
  const claim = useClaim(id);
  const [renaming, setRenaming] = useState(false);
  // The photo is a local cache file, handed over in memory (never in the route, which a deep link
  // can fill); the share screen deletes it when it closes.
  const openShare = useCallback(
    (photo: PickedPhoto) =>
      router.push({ pathname: '/share-photo/[id]', params: { id, photo: pendingPhoto.give(photo) } }),
    [id]
  );

  if (detail === undefined || detail === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg, gap: 10 }}>
        <ActivityIndicator />
        <Text style={{ color: p.muted }}>{detail === null ? t('saving') : tc('loading')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: detail.name }} />
      <ActivityDetailView
        a={detail}
        mapOverlay={<ClaimLayers claim={claim} />}
        top={<SharePromptCard userId={userId} justFinished={justFinished === '1'} onPicked={openShare} />}
      >
        {isImportedFromHealth(detail.id) && (
          <Text testID='from-apple-health' style={{ color: p.muted, textAlign: 'center' }}>
            {t('fromAppleHealth')}
          </Text>
        )}
        <TurfGainedCard claim={claim} />
        <SharePhotoButton onPicked={openShare} />
        <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
          <Button
            testID='rename-activity'
            label={t('rename.action')}
            color={p.card}
            textColor={p.text}
            onPress={() => setRenaming(true)}
            style={{ flex: 1 }}
          />
          <Button
            testID='delete-activity'
            label={t('deleteButton')}
            color={p.card}
            textColor={p.danger}
            style={{ flex: 1 }}
            onPress={() =>
              Alert.alert(t('deleteTitle'), t('deleteBody'), [
                { text: tc('cancel'), style: 'cancel' },
                {
                  text: tc('delete'),
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
