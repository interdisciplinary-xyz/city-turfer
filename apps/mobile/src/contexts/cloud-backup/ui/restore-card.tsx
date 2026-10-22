import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { ERROR_TEXT } from './cloud-backup-card.constants';
import { useRestore } from './hooks';
import {
  BACKUP_OFF_AFTER_RESTORE,
  describeOffer,
  describeProgress,
  describeResult,
  RESTORE_TITLE,
  TURN_ON_BACKUP,
} from './restore-card.constants';

/**
 * Home screen card when the account's backup holds activities this phone doesn't have:
 * Restore / Not now; afterwards "Turn on backup" if the restore couldn't turn it on itself.
 */
export function RestoreCard() {
  const p = usePalette();
  const { offer, progress, result, running, start, dismiss, turnOnBackup } = useRestore();
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const message = describeResult(result);
  const offered = offer && offer.kind !== 'none' ? offer : null;
  if (!offered && !message) {
    return null;
  }
  const done = result?.kind === 'done';
  const backupOff = result?.kind === 'done' && !result.backupOn;
  const enable = async () => {
    setEnabling(true);
    setEnableError(null);
    try {
      const r = await turnOnBackup();
      setEnableError(r.kind === 'failed' ? ERROR_TEXT[r.error] : null);
    } catch {
      setEnableError(ERROR_TEXT.server);
    } finally {
      setEnabling(false);
    }
  };
  return (
    <Card testID='restore-card' style={{ gap: SPACE.md }}>
      <Text style={[s.h2, { color: p.text }]}>{RESTORE_TITLE}</Text>
      {offered && !done && <Text style={{ color: p.muted }}>{describeOffer(offered)}</Text>}
      {running && (
        <Text testID='restore-progress' style={{ color: p.text }}>
          {describeProgress(progress)}
        </Text>
      )}
      {message && !running && (
        <Text testID='restore-message' style={{ color: done ? p.text : p.muted }}>
          {message}
        </Text>
      )}
      {backupOff && (
        <Text testID='restore-backup-off' style={{ color: p.muted }}>
          {BACKUP_OFF_AFTER_RESTORE}
        </Text>
      )}
      {enableError && (
        <Text testID='restore-backup-error' style={{ color: p.danger, fontSize: FONT_SIZE.caption }}>
          {enableError}
        </Text>
      )}
      <View style={s.row}>
        {backupOff && (
          <Button
            testID='restore-backup-on'
            label={TURN_ON_BACKUP}
            color={ACCENT}
            busy={enabling}
            onPress={() => void enable()}
          />
        )}
        {offered && !done && (
          <Button testID='restore-start' label='Restore' color={ACCENT} busy={running} onPress={() => void start()} />
        )}
        {!running && !enabling && (
          <Button
            testID='restore-dismiss'
            label={done ? 'Done' : 'Not now'}
            color={p.border}
            textColor={p.text}
            onPress={dismiss}
          />
        )}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: FONT_WEIGHT.heavy },
  row: { flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' },
});
