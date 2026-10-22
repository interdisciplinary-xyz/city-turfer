import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import type { BackupCommandResult } from '../contract';
import {
  ACTION_ERRORS,
  ACTION_FAILED,
  BACKUP_PRIVACY,
  BACKUP_SWITCH_LABEL,
  CLOUD_BACKUP_PITCH,
  CLOUD_BACKUP_TITLE,
  describeRefused,
  ERROR_TEXT,
  ERROR_TITLE,
  HEALTH_NOTE,
  HEALTH_SWITCH_LABEL,
  OFF_CONFIRM_TEXT,
  OFF_CONFIRM_TITLE,
  OFF_PENDING,
} from './cloud-backup-card.constants';
import { describeProgress } from './format';
import { useCloudBackup } from './hooks';

/** Turning backup off erases the server copy: ask first. */
const confirmOff = (off: () => void) =>
  Alert.alert(OFF_CONFIRM_TITLE, OFF_CONFIRM_TEXT, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Turn off', style: 'destructive', onPress: off },
  ]);

const showError = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  Alert.alert(ERROR_TITLE, (code && ACTION_ERRORS[code]) || ACTION_FAILED);
};

/**
 * Info screen card (the device token and testing server are in Developer tools): consent switch ("Back up to CityTurfer cloud"), Apple Health
 * switch, progress and "Back up now". The token is entered secure and never shown again.
 */
export function CloudBackupCard() {
  const p = usePalette();
  const { status, setEnabled, setHealthIncluded, backUpNow } = useCloudBackup();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!status) {
    return null;
  }
  if (!status.available) {
    return (
      <Card style={{ gap: SPACE.md }}>
        <Text style={[s.h2, { color: p.text }]}>{CLOUD_BACKUP_TITLE}</Text>
        <Text testID='backup-not-available' style={{ color: p.muted }}>
          {ERROR_TEXT['not-available']}
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
      setNotice(turningOn ? ERROR_TEXT[r.error] : OFF_PENDING);
    }
  };

  const error = notice ?? (status.enabled && status.lastError ? ERROR_TEXT[status.lastError] : null);

  return (
    <Card style={{ gap: SPACE.md }}>
      <Text style={[s.h2, { color: p.text }]}>{CLOUD_BACKUP_TITLE}</Text>
      <Text style={{ color: p.muted }}>{CLOUD_BACKUP_PITCH}</Text>
      {!status.hasToken && (
        <Text testID='backup-sign-in-first' style={{ color: p.text }}>
          {ERROR_TEXT['no-token']}
        </Text>
      )}

      <View style={s.row}>
        <Text style={[s.label, s.grow, { color: p.text }]}>{BACKUP_SWITCH_LABEL}</Text>
        <Switch
          testID='backup-switch'
          accessibilityLabel={BACKUP_SWITCH_LABEL}
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
      <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{BACKUP_PRIVACY}</Text>

      {status.enabled && Platform.OS === 'ios' && (
        <>
          <View style={s.row}>
            <Text style={[s.label, s.grow, { color: p.text }]}>{HEALTH_SWITCH_LABEL}</Text>
            <Switch
              testID='backup-health-switch'
              accessibilityLabel={HEALTH_SWITCH_LABEL}
              value={status.healthIncluded}
              disabled={busy}
              onValueChange={(on) => run(async () => switched(await setHealthIncluded(on), on))}
              trackColor={{ true: ACCENT, false: p.border }}
            />
          </View>
          <Text style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>{HEALTH_NOTE}</Text>
        </>
      )}

      {status.enabled && (
        <Text testID='backup-status' style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>
          {status.running ? 'Backing up…' : describeProgress(status, Date.now())}
        </Text>
      )}
      {status.enabled && status.refused > 0 && (
        <Text testID='backup-refused' style={{ color: p.muted, fontSize: FONT_SIZE.caption }}>
          {describeRefused(status.refused)}
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
          label='Back up now'
          color={p.border}
          textColor={p.text}
          busy={status.running}
          disabled={busy}
          onPress={() => run(() => backUpNow())}
        />
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
