import * as Location from 'expo-location';
import * as Updates from 'expo-updates';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { TYPE_COLOR } from '@/constants/colors';
import { removeDemoHistory, seedDemoHistory } from '@/dev/demo-history';
import { useContainer } from '@/ui-kit/app-context';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

/** Long-presses on the version text needed to reveal developer tools in release builds. */
const DEV_TAPS = 5;

export default function InfoScreen() {
  const p = usePalette();
  const c = useContainer();
  const [seeding, setSeeding] = useState<string | null>(null);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const taps = useRef(0);
  const showDevTools = __DEV__ || devUnlocked;
  const [checking, setChecking] = useState<string | null>(null);

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

  const onVersionLongPress = () => {
    if (++taps.current >= DEV_TAPS && !devUnlocked) {
      setDevUnlocked(true);
      Alert.alert('Developer tools', 'Developer tools are now visible on this screen.');
    }
  };

  const checkForUpdates = async () => {
    try {
      setChecking('Checking…');
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        setChecking('Up to date');
        return;
      }
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      Alert.alert('Update failed', String((e as Error).message ?? e));
      setChecking(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card style={{ gap: 8 }}>
        <Text style={[s.h2, { color: p.text }]}>App version</Text>
        <Pressable testID='app-version-press' accessibilityRole='text' onLongPress={onVersionLongPress}>
          <Text testID='app-version' style={{ color: p.muted, fontSize: 13 }}>
            {Updates.isEnabled
              ? `Update ${Updates.updateId?.slice(0, 8) ?? 'embedded'} · ${Updates.createdAt ? Updates.createdAt.toLocaleString() : 'built in'}${Updates.channel ? ` · ${Updates.channel}` : ''}`
              : 'Development build (updates come from Metro)'}
          </Text>
        </Pressable>
        {Updates.isEnabled && (
          <Button
            testID='check-updates'
            label={checking ?? 'Check for updates'}
            color={p.border}
            textColor={p.text}
            busy={checking === 'Checking…'}
            onPress={checkForUpdates}
          />
        )}
      </Card>
      <Card style={{ gap: 8 }}>
        <Text style={[s.h2, { color: p.text }]}>Your data</Text>
        <Text style={{ color: p.muted }}>
          Activities and turf are stored only on this phone. When GPS drops out, just the two ends of the gap are sent
          to the OpenStreetMap router to estimate the street route — never your whole track.
        </Text>
      </Card>
      {showDevTools && (
        <Card style={{ gap: 10 }}>
          <Text style={[s.h2, { color: p.text }]}>Developer tools</Text>
          <Text style={{ color: p.muted }}>
            Generate 90 days of walks, runs and rides around your current location to preview the Turf map.
          </Text>
          <Button
            testID='seed-demo'
            label={seeding ?? 'Seed demo history'}
            color={TYPE_COLOR.cycle}
            onPress={seed}
            busy={!!seeding}
          />
          <Button
            testID='remove-demo'
            label='Remove demo data'
            color={p.border}
            textColor={p.danger}
            onPress={removeDemo}
            disabled={!!seeding}
          />
        </Card>
      )}
      <Text style={{ color: p.muted, textAlign: 'center', fontSize: 12 }}>
        CityTurfer · Surf your city. Own your streets. · proof of concept
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({ h2: { fontSize: 17, fontWeight: '800' } });
