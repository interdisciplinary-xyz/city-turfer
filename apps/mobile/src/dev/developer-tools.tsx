/**
 * Dev-only: the Developer tools card on Info (demo history, sample Apple Health workouts) and the
 * notice that unlocks it. Shown in development builds, or after long-pressing the version line in a
 * release build. Not translated: developer copy stays English (mobile-i18n skill, "Not translated").
 */
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { removeDemoHistory, seedDemoHistory } from '@/dev/demo-history';
import { seedHealthWorkouts } from '@/dev/health-seed';
import { useContainer } from '@/ui-kit/app-context';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

/** Says the developer tools are now visible (after the long-presses on the version line). */
export function announceDeveloperTools(): void {
  Alert.alert('Developer tools', 'Developer tools are now visible on this screen.');
}

export function DeveloperToolsCard() {
  const p = usePalette();
  const c = useContainer();
  const [seeding, setSeeding] = useState<string | null>(null);

  const seed = async () => {
    try {
      setSeeding('Finding your location…');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const n = await seedDemoHistory(c, { lat: pos.coords.latitude, lon: pos.coords.longitude }, 90, (d, t) =>
        setSeeding(`Importing ${d}/${t}…`)
      );
      Alert.alert('Demo history added', `${n} activities around your location. Open the Turf tab.`);
    } catch (e) {
      Alert.alert('Could not seed', String((e as Error).message ?? e));
    } finally {
      setSeeding(null);
    }
  };

  const seedHealth = async () => {
    try {
      setSeeding('Writing to Apple Health…');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const n = await seedHealthWorkouts({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      Alert.alert('Health workouts added', `${n} workouts with routes are in Apple Health. Tap Import now.`);
    } catch (e) {
      Alert.alert('Could not seed Health', String((e as Error).message ?? e));
    } finally {
      setSeeding(null);
    }
  };

  const removeDemo = () =>
    Alert.alert('Remove demo data?', 'Deletes all demo activities and releases the turf they claimed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setSeeding('Removing demo data…');
            const n = await removeDemoHistory(c);
            Alert.alert('Demo data removed', `${n} demo activities deleted.`);
          } catch (e) {
            Alert.alert('Could not remove', String((e as Error).message ?? e));
          } finally {
            setSeeding(null);
          }
        },
      },
    ]);

  return (
    <Card style={{ gap: 10 }}>
      <Text style={[s.h2, { color: p.text }]}>Developer tools</Text>
      <Text style={{ color: p.muted }}>
        Generate 90 days of walks, runs and rides around your current location to preview the Turf map.
      </Text>
      <Button
        testID='seed-demo'
        label={seeding ?? 'Seed demo history'}
        color={p.border}
        textColor={p.text}
        onPress={seed}
        busy={!!seeding}
      />
      {Platform.OS === 'ios' && (
        <Button
          testID='seed-health'
          label='Add sample workouts to Apple Health'
          color={p.border}
          textColor={p.text}
          onPress={seedHealth}
          disabled={!!seeding}
        />
      )}
      <Button
        testID='remove-demo'
        label='Remove demo data'
        color={p.border}
        textColor={p.danger}
        onPress={removeDemo}
        disabled={!!seeding}
      />
    </Card>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '800' },
});
