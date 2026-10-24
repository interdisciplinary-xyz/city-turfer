import { SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { afterCredentialsPlan } from '@/contexts/cloud-backup';
import { ERROR_KEY } from '@/contexts/cloud-backup/ui/cloud-backup-card.constants';
import { useCloudBackup } from '@/contexts/cloud-backup/ui/hooks';
import { BackupLinkFlow } from '@/contexts/identity/ui/backup-link-flow';
import type { LinkedOutcome } from '@/contexts/identity/ui/backup-link-flow.constants';
import { translator } from '@/i18n';
import { usePalette } from '@/ui-kit/theme';

/**
 * Info › Cloud backup › "Email me a code" on a local profile (mock admin, demo; decision LP1):
 * Identity links the profile's own account with the e-mailed code, then Cloud Backup decides
 * (`afterCredentials`, from the settings read right then):
 * - off with nothing pending: the Turfer came to turn it on (consent `cloud-sync` only; Apple
 *   Health stays a separate switch), the first run starts, back to Info;
 * - on already (opened by password, LP2, or its session ran out): a run, back to Info; decided
 *   once connected: if the address's account is a new one (the old one was deleted), backup is off
 *   for it and the flow asks for "Turn on backup" (the consent tap) instead;
 * - turned off while it had no credentials: a run delivers that withdrawal (the server deletes its
 *   copy) and backup stays off, worded from whether it arrived; never turned back on from here.
 */
export default function LinkBackupScreen() {
  const p = usePalette();
  const { status, afterCredentials } = useCloudBackup();

  const onLinked = async (): Promise<LinkedOutcome> => {
    const te = translator('errors');
    const t = translator('backup');
    try {
      const r = await afterCredentials();
      if (r.kind === 'stayed-off') {
        const message = r.delivered ? t('link.stayedOff') : t('link.stayedOffPending');
        return { kind: 'stayed-off', delivered: r.delivered, message };
      }
      if (r.kind === 'needs-consent') {
        // A new account for this address: on only with the Turfer's "Turn on backup" (the retry).
        return { kind: 'failed', message: t('link.newAccount') };
      }
      if (r.kind === 'failed') {
        return { kind: 'failed', message: te(ERROR_KEY[r.error]) };
      }
    } catch {
      return { kind: 'failed', message: te('generic') };
    }
    router.back();
    return { kind: 'left' };
  };

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: SPACE.lg }}
      keyboardShouldPersistTaps='handled'
      automaticallyAdjustKeyboardInsets
    >
      <BackupLinkFlow
        onLinked={onLinked}
        onDone={() => router.back()}
        turnsOn={status ? afterCredentialsPlan(status) === 'enable' : true}
      />
    </ScrollView>
  );
}
