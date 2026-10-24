import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { ERROR_KEY, type RestoreCardProps } from './cloud-backup-card.constants';
import { describeOffer, describeRestoreProgress, describeRestoreResult } from './format';
import { useRestore } from './hooks';

/**
 * Home screen card when the account's backup holds activities this phone doesn't have:
 * Restore / Not now; afterwards "Turn on backup" if the restore couldn't turn it on itself.
 */
export function RestoreCard({ localProfile = false }: RestoreCardProps) {
  const p = usePalette();
  const t = useT('backup');
  const tc = useT('common');
  const te = useT('errors');
  const { offer, progress, result, running, start, dismiss, turnOnBackup } = useRestore();
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<keyof typeof ERROR_KEY | null>(null);
  const message = describeRestoreResult(result, t, { health: Platform.OS === 'ios', localProfile });
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
      setEnableError(r.kind === 'failed' ? r.error : null);
    } catch {
      setEnableError('server');
    } finally {
      setEnabling(false);
    }
  };
  return (
    <Card testID='restore-card' style={{ gap: SPACE.md }}>
      <Text style={[s.h2, { color: p.text }]}>{t('restore.title')}</Text>
      {offered && !done && <Text style={{ color: p.muted }}>{describeOffer(offered, t)}</Text>}
      {running && (
        <Text testID='restore-progress' style={{ color: p.text }}>
          {describeRestoreProgress(progress, t)}
        </Text>
      )}
      {message && !running && (
        <Text testID='restore-message' style={{ color: done ? p.text : p.muted }}>
          {message}
        </Text>
      )}
      {backupOff && (
        <Text testID='restore-backup-off' style={{ color: p.muted }}>
          {t('restore.backupOff')}
        </Text>
      )}
      {enableError && (
        <Text testID='restore-backup-error' style={{ color: p.danger, fontSize: FONT_SIZE.caption }}>
          {te(ERROR_KEY[enableError])}
        </Text>
      )}
      <View style={s.row}>
        {backupOff && (
          <Button
            testID='restore-backup-on'
            label={t('restore.turnOnBackup')}
            color={ACCENT}
            busy={enabling}
            onPress={() => void enable()}
          />
        )}
        {offered && !done && (
          <Button
            testID='restore-start'
            label={t('restore.start')}
            color={ACCENT}
            busy={running}
            onPress={() => void start()}
          />
        )}
        {!running && !enabling && (
          <Button
            testID='restore-dismiss'
            label={done ? tc('done') : t('restore.notNow')}
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
