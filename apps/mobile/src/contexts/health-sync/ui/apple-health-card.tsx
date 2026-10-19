import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import {
  APPLE_HEALTH_PITCH,
  APPLE_HEALTH_PRIVACY,
  APPLE_HEALTH_TITLE,
  describeImport,
  ERROR_TITLE,
  HISTORY_TIP,
  NO_WORKOUTS_HINT,
} from './apple-health-card.constants';
import { useHealthSync } from './hooks';

const showError = (e: unknown) => Alert.alert(ERROR_TITLE, String((e as Error)?.message ?? e));

/** Settings card: connect Apple Health, choose import/export, import now. Hidden where Health doesn't exist. */
export function AppleHealthCard() {
  const p = usePalette();
  const { status, progress, connect, disconnect, importNow, setDirections } = useHealthSync();
  const [busy, setBusy] = useState(false);

  if (!status?.available) {
    return null;
  }

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    work()
      .catch(showError)
      .finally(() => setBusy(false));
  };

  const importing = progress != null || status.importing;
  const last = status.lastImport;

  return (
    <Card style={{ gap: 10 }}>
      <Text style={[s.h2, { color: p.text }]}>{APPLE_HEALTH_TITLE}</Text>
      {!status.connected ? (
        <>
          <Text style={{ color: p.muted }}>{APPLE_HEALTH_PITCH}</Text>
          <Text style={{ color: p.muted, fontSize: 13 }}>{HISTORY_TIP}</Text>
          <Button
            testID='health-connect'
            label='Connect Apple Health'
            color={ACCENT}
            busy={busy}
            onPress={() => run(connect)}
          />
        </>
      ) : (
        <>
          <View style={s.row}>
            <Text style={[s.label, { color: p.text }]}>Import workouts</Text>
            <Switch
              testID='health-import-switch'
              accessibilityLabel='Import workouts from Apple Health'
              value={status.importEnabled}
              onValueChange={(on) => run(() => setDirections({ importEnabled: on }))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <View style={s.row}>
            <Text style={[s.label, { color: p.text }]}>Save recordings to Health</Text>
            <Switch
              testID='health-export-switch'
              accessibilityLabel='Save recordings to Apple Health'
              value={status.exportEnabled}
              onValueChange={(on) => run(() => setDirections({ exportEnabled: on }))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <Text testID='health-last-import' style={{ color: p.muted, fontSize: 13 }}>
            {importing
              ? `Importing… ${progress ?? 0} added so far`
              : last
                ? `Last import: ${describeImport(last)}`
                : 'Not imported yet.'}
          </Text>
          {!importing && last && last.imported === 0 && last.duplicates === 0 && (
            <Text style={{ color: p.muted, fontSize: 13 }}>{NO_WORKOUTS_HINT}</Text>
          )}
          {status.importEnabled && (
            <Button
              testID='health-import-now'
              label='Import now'
              color={p.border}
              textColor={p.text}
              busy={importing}
              disabled={busy}
              onPress={() => run(importNow)}
            />
          )}
          <Text style={{ color: p.muted, fontSize: 12 }}>{APPLE_HEALTH_PRIVACY}</Text>
          <Button
            testID='health-disconnect'
            label='Disconnect'
            color={p.card}
            textColor={p.danger}
            disabled={busy || importing}
            onPress={() => run(disconnect)}
          />
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
});
