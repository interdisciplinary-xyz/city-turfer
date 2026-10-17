import * as Location from 'expo-location';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT, TYPE_COLOR } from '@/constants/colors';
import { useGapEstimationSetting } from '@/contexts/activity-log/ui/hooks';
import { seedDemoHistory } from '@/dev/demo-history';
import { useContainer } from '@/ui-kit/app-context';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

export default function InfoScreen() {
  const p = usePalette();
  const c = useContainer();
  const [seeding, setSeeding] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [estimateGaps, setEstimateGaps] = useGapEstimationSetting();

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
        <Text testID='app-version' style={{ color: p.muted, fontSize: 13 }} selectable>
          {Updates.isEnabled
            ? `Update ${Updates.updateId?.slice(0, 8) ?? 'embedded'} · ${Updates.createdAt ? Updates.createdAt.toLocaleString() : 'built in'}${Updates.channel ? ` · ${Updates.channel}` : ''}`
            : 'Development build (updates come from Metro)'}
        </Text>
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
        <View style={s.row}>
          <Text style={[s.label, { color: p.text }]}>Estimate GPS gaps along streets</Text>
          <Switch
            testID='estimate-gaps-switch'
            accessibilityLabel='Estimate GPS gaps along streets'
            value={estimateGaps ?? false}
            disabled={estimateGaps == null}
            onValueChange={(on) =>
              setEstimateGaps(on).catch((e) => Alert.alert('Could not save', String((e as Error).message ?? e)))
            }
            trackColor={{ true: ACCENT, false: p.border }}
          />
        </View>
        <Text style={{ color: p.muted, fontSize: 13 }}>
          Off: no requests leave the phone; gaps stay as dashed straight lines.
        </Text>
      </Card>
      <Card style={{ gap: 10 }}>
        <Text style={[s.h2, { color: p.text }]}>Demo data</Text>
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
      </Card>
      <Text style={{ color: p.muted, textAlign: 'center', fontSize: 12 }}>
        CityTurfer · Surf your city. Own your streets. · proof of concept
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
});
