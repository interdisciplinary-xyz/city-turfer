import * as Location from 'expo-location';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTurfSummary } from '@/contexts/territory/ui/hooks';
import { seedDemoHistory } from '@/dev/demoHistory';
import { useApp, useContainer } from '@/ui-kit/AppContext';
import { Button, Card, Stat } from '@/ui-kit/components';
import { formatArea } from '@/ui-kit/format';
import { TYPE_COLOR, usePalette } from '@/ui-kit/theme';

export default function MeScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { auth, signOut } = useApp();
  const c = useContainer();
  const summary = useTurfSummary();
  const [seeding, setSeeding] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const user = auth.status === 'signed-in' ? auth.user : null;

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

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 14 }}
    >
      <Text style={[s.h1, { color: p.text }]}>{user?.displayName ?? 'Me'}</Text>
      <Text style={{ color: p.muted }}>{user?.email}</Text>
      <Card>
        <View style={{ flexDirection: 'row' }}>
          <Stat label='Turf' value={summary ? formatArea(summary.areaKm2) : '—'} />
          <Stat label='Cells' value={summary ? String(summary.cellCount) : '—'} />
          <Stat label='Strong' value={summary ? String(summary.strongCells) : '—'} />
        </View>
        {summary && (
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Stat label='Walk cells' value={String(summary.byType.walk)} />
            <Stat label='Run cells' value={String(summary.byType.run)} />
            <Stat label='Ride cells' value={String(summary.byType.cycle)} />
          </View>
        )}
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
      <Card style={{ gap: 8 }}>
        <Text style={[s.h2, { color: p.text }]}>App version</Text>
        <Text style={{ color: p.muted, fontSize: 13 }} selectable>
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
            onPress={async () => {
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
            }}
          />
        )}
      </Card>
      <Button
        testID='sign-out'
        label='Sign out'
        color={p.border}
        textColor={p.text}
        onPress={async () => {
          if ((await signOut()) === 'recording-in-progress') {
            Alert.alert('Recording in progress', 'Finish or discard your recording first.');
          }
        }}
      />
      <Text style={{ color: p.muted, textAlign: 'center', fontSize: 12 }}>CityTurfer · proof of concept</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '900' },
  h2: { fontSize: 17, fontWeight: '800' },
});
