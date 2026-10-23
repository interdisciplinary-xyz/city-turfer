import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { translator, useT } from '@/i18n';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { describeImport, healthErrorKey } from './apple-health-card.constants';
import { useHealthSync } from './hooks';

/** Explains a failure in the app language; the error's own text (and any Health data) is never shown. */
const showError = (e: unknown) => {
  const t = translator('health');
  Alert.alert(t('errors.title'), t(healthErrorKey(e)));
};

/** Settings card: connect Apple Health, choose import/export, import now. Hidden where Health doesn't exist. */
export function AppleHealthCard() {
  const p = usePalette();
  const t = useT('health');
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
      <Text style={[s.h2, { color: p.text }]}>{t('title')}</Text>
      {!status.connected ? (
        <>
          <Text style={{ color: p.muted }}>{t('pitch')}</Text>
          <Text style={{ color: p.muted, fontSize: 13 }}>{t('historyTip')}</Text>
          <Button
            testID='health-connect'
            label={t('connect')}
            color={ACCENT}
            busy={busy}
            onPress={() => run(connect)}
          />
        </>
      ) : (
        <>
          <View style={s.row}>
            <Text style={[s.label, { color: p.text }]}>{t('importSwitch')}</Text>
            <Switch
              testID='health-import-switch'
              accessibilityLabel={t('importSwitchLabel')}
              value={status.importEnabled}
              onValueChange={(on) => run(() => setDirections({ importEnabled: on }))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <View style={s.row}>
            <Text style={[s.label, { color: p.text }]}>{t('exportSwitch')}</Text>
            <Switch
              testID='health-export-switch'
              accessibilityLabel={t('exportSwitchLabel')}
              value={status.exportEnabled}
              onValueChange={(on) => run(() => setDirections({ exportEnabled: on }))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <Text testID='health-last-import' style={{ color: p.muted, fontSize: 13 }}>
            {importing
              ? t('importing', { count: progress ?? 0 })
              : last
                ? t('lastImport', { summary: describeImport(last, t) })
                : t('notImported')}
          </Text>
          {!importing && last && last.imported === 0 && last.duplicates === 0 && (
            <Text style={{ color: p.muted, fontSize: 13 }}>{t('noWorkoutsHint')}</Text>
          )}
          {status.importEnabled && (
            <Button
              testID='health-import-now'
              label={t('importNow')}
              color={p.border}
              textColor={p.text}
              busy={importing}
              disabled={busy}
              onPress={() => run(importNow)}
            />
          )}
          <Text style={{ color: p.muted, fontSize: 12 }}>{t('privacy')}</Text>
          <Button
            testID='health-disconnect'
            label={t('disconnect')}
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
