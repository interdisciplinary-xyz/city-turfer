import { StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';
import { useAsyncAction } from '@/ui-kit/use-async-action';

import type { ImportReport } from '../contract';
import { describeImport, healthActionError, importedToast } from './apple-health-card.constants';
import { useHealthSync } from './hooks';

/**
 * Settings card: connect Apple Health, choose import/export, import now. Hidden where Health
 * doesn't exist. Every action follows the async-request rule (`useAsyncAction`): an unexpected
 * failure is reported with area and code only (never Health data), every failure shows a toast in
 * the app language (never the error's own text). Success toasts only where the card doesn't show
 * the result itself: Import now (how many were added) and Disconnect.
 */
export function AppleHealthCard() {
  const p = usePalette();
  const t = useT('health');
  const { status, progress, connect, disconnect, importNow, setDirections } = useHealthSync();
  // Connect and the switches show their result on the card: no success toast.
  const connecting = useAsyncAction<unknown>({ area: 'health-sync', code: 'connect', errorKey: healthActionError });
  const directions = useAsyncAction<void>({
    area: 'health-sync',
    code: 'set-directions',
    errorKey: healthActionError,
  });
  const importing = useAsyncAction<ImportReport | null>({
    area: 'health-sync',
    code: 'import-now',
    errorKey: healthActionError,
    successKey: importedToast,
  });
  const disconnecting = useAsyncAction<void>({
    area: 'health-sync',
    code: 'disconnect',
    errorKey: healthActionError,
    successKey: 'health.toast.disconnected',
  });

  if (!status?.available) {
    return null;
  }

  const busy = connecting.isLoading || directions.isLoading || importing.isLoading || disconnecting.isLoading;
  const importRunning = progress != null || status.importing;
  const last = status.lastImport;

  return (
    <Card style={{ gap: 10 }}>
      <Text style={[s.h2, { color: p.text }]}>{t('title')}</Text>
      {!status.connected ? (
        <>
          <Text style={{ color: p.muted }}>{t('pitch')}</Text>
          <Text style={{ color: p.muted, fontSize: 13 }}>{t('startTip')}</Text>
          <Button
            testID='health-connect'
            label={t('connect')}
            color={ACCENT}
            busy={connecting.isLoading}
            disabled={busy}
            onPress={() => void connecting.run(connect)}
          />
        </>
      ) : (
        <>
          <View style={s.row}>
            <Text style={[s.label, { color: p.text }]}>{t('importSwitch')}</Text>
            <Switch
              testID='health-import-switch'
              accessibilityRole='switch'
              accessibilityLabel={t('importSwitchLabel')}
              accessibilityState={{ checked: status.importEnabled, disabled: busy }}
              value={status.importEnabled}
              disabled={busy}
              onValueChange={(on) => void directions.run(() => setDirections({ importEnabled: on }))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <View style={s.row}>
            <Text style={[s.label, { color: p.text }]}>{t('exportSwitch')}</Text>
            <Switch
              testID='health-export-switch'
              accessibilityRole='switch'
              accessibilityLabel={t('exportSwitchLabel')}
              accessibilityState={{ checked: status.exportEnabled, disabled: busy }}
              value={status.exportEnabled}
              disabled={busy}
              onValueChange={(on) => void directions.run(() => setDirections({ exportEnabled: on }))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <Text testID='health-last-import' style={{ color: p.muted, fontSize: 13 }}>
            {importRunning
              ? t('importing', { count: progress ?? 0 })
              : last
                ? t('lastImport', { summary: describeImport(last, t) })
                : t('notImported')}
          </Text>
          {!importRunning && last && last.imported === 0 && last.duplicates === 0 && !last.beforeStart && (
            <Text style={{ color: p.muted, fontSize: 13 }}>{t('noWorkoutsHint')}</Text>
          )}
          {status.importEnabled && (
            <Button
              testID='health-import-now'
              label={t('importNow')}
              color={p.border}
              textColor={p.text}
              busy={importRunning || importing.isLoading}
              disabled={busy}
              onPress={() => void importing.run(importNow)}
            />
          )}
          <Text style={{ color: p.muted, fontSize: 12 }}>{t('privacy')}</Text>
          <Button
            testID='health-disconnect'
            label={t('disconnect')}
            color={p.card}
            textColor={p.danger}
            busy={disconnecting.isLoading}
            disabled={busy || importRunning}
            onPress={() => void disconnecting.run(disconnect)}
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
