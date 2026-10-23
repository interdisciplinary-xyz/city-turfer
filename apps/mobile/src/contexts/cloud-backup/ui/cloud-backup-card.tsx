import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { translator, useT } from '@/i18n';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import type { BackupCommandResult } from '../contract';
import { ACTION_ERROR_KEY, type BackupErrorKey, ERROR_KEY } from './cloud-backup-card.constants';
import { describeProgress, describeRefused, describeRestoreProgress, describeRestoreResult } from './format';
import { useCloudBackup, useRestore } from './hooks';

/** Turning backup off erases the server copy: ask first. */
const confirmOff = (off: () => void) => {
  const t = translator('backup');
  Alert.alert(t('offConfirmTitle'), t('offConfirmText'), [
    { text: translator('common')('cancel'), style: 'cancel' },
    { text: t('turnOff'), style: 'destructive', onPress: off },
  ]);
};

/** A failed action: its domain code's message, else a generic one (never the raw error text). */
const showError = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  const te = translator('errors');
  Alert.alert(translator('backup')('title'), te((code && ACTION_ERROR_KEY[code]) || 'generic'));
};

/**
 * Info screen card (the device token and testing server are in Developer tools): consent switch ("Back up to CityTurfer cloud"), Apple Health
 * switch, progress and "Back up now". The token is entered secure and never shown again.
 */
export function CloudBackupCard() {
  const p = usePalette();
  const t = useT('backup');
  const te = useT('errors');
  const { status, refresh, setEnabled, setHealthIncluded, backUpNow } = useCloudBackup();
  const restore = useRestore({ ask: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<BackupErrorKey | null>(null);

  if (!status) {
    return null;
  }
  if (!status.available) {
    return (
      <Card style={{ gap: SPACE.md }}>
        <Text style={[s.h2, { color: p.text }]}>{t('title')}</Text>
        <Text testID='backup-not-available' style={{ color: p.muted }}>
          {te(ERROR_KEY['not-available'])}
        </Text>
      </Card>
    );
  }

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    work()
      .catch(showError)
      .finally(() => setBusy(false));
  };

  const switched = (r: BackupCommandResult, turningOn: boolean) => {
    if (r.kind === 'failed') {
      setNotice(turningOn ? ERROR_KEY[r.error] : 'backupOffPending');
    }
  };

  const restoreMessage = describeRestoreResult(restore.result, t, { health: Platform.OS === 'ios' });
  const errorKey = notice ?? (status.enabled && status.lastError ? ERROR_KEY[status.lastError] : null);
  const error = errorKey ? te(errorKey) : null;

  return (
    <Card style={{ gap: SPACE.md }}>
      <Text style={[s.h2, { color: p.text }]}>{t('title')}</Text>
      <Text style={{ color: p.muted }}>{t('pitch')}</Text>
      {!status.hasToken && (
        <Text testID='backup-sign-in-first' style={{ color: p.text }}>
          {te(ERROR_KEY['no-token'])}
        </Text>
      )}

      <View style={s.row}>
        <Text style={[s.label, s.grow, { color: p.text }]}>{t('switchLabel')}</Text>
        <Switch
          testID='backup-switch'
          accessibilityLabel={t('switchLabel')}
          value={status.enabled}
          disabled={busy || (!status.enabled && !status.hasToken)}
          onValueChange={(on) =>
            on
              ? run(async () => switched(await setEnabled(true), true))
              : confirmOff(() => run(async () => switched(await setEnabled(false), false)))
          }
          trackColor={{ true: ACCENT, false: p.border }}
        />
      </View>
      <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{t('privacy')}</Text>

      {status.enabled && Platform.OS === 'ios' && (
        <>
          <View style={s.row}>
            <Text style={[s.label, s.grow, { color: p.text }]}>{t('healthSwitchLabel')}</Text>
            <Switch
              testID='backup-health-switch'
              accessibilityLabel={t('healthSwitchLabel')}
              value={status.healthIncluded}
              disabled={busy}
              onValueChange={(on) => run(async () => switched(await setHealthIncluded(on), on))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{t('healthNote')}</Text>
        </>
      )}

      {status.enabled && (
        <Text testID='backup-status' style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>
          {status.running ? t('backingUp') : describeProgress(status, Date.now(), t)}
        </Text>
      )}
      {status.enabled && status.refused > 0 && (
        <Text testID='backup-refused' style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>
          {describeRefused(status.refused, t)}
        </Text>
      )}
      {error && (
        <Text testID='backup-error' style={{ color: p.danger, fontSize: FONT_SIZE.caption }}>
          {error}
        </Text>
      )}
      {status.enabled && (
        <Button
          testID='backup-now'
          label={t('backUpNow')}
          color={p.border}
          textColor={p.text}
          busy={status.running}
          disabled={busy}
          onPress={() =>
            run(async () => {
              const r = await backUpNow();
              if (r?.kind === 'skipped' && r.reason === 'busy') {
                setNotice('backupWaitingForRestore');
              }
            })
          }
        />
      )}

      {status.hasToken && (
        <>
          <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{t('restore.actionNote')}</Text>
          {restore.running && (
            <Text testID='backup-restore-progress' style={{ color: p.text, fontSize: FONT_SIZE.caption }}>
              {describeRestoreProgress(restore.progress, t)}
            </Text>
          )}
          {!restore.running && restoreMessage && (
            <Text testID='backup-restore-message' style={{ color: p.text, fontSize: FONT_SIZE.caption }}>
              {restoreMessage}
            </Text>
          )}
          <Button
            testID='backup-restore'
            label={t('restore.action')}
            color={p.border}
            textColor={p.text}
            busy={restore.running}
            disabled={busy || status.running}
            onPress={() => run(() => restore.start().then(refresh))}
          />
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: FONT_WEIGHT.heavy },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  grow: { flex: 1 },
  label: { fontSize: 15, fontWeight: FONT_WEIGHT.bold },
  link: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, paddingVertical: SPACE.xs },
  input: {
    fontSize: FONT_SIZE.body,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
});
