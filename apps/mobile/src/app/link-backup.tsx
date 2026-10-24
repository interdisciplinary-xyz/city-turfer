import { SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { ERROR_KEY } from '@/contexts/cloud-backup/ui/cloud-backup-card.constants';
import { afterLinkPlan } from '@/contexts/cloud-backup/ui/cloud-backup-card-state';
import { useCloudBackup } from '@/contexts/cloud-backup/ui/hooks';
import { BackupLinkFlow } from '@/contexts/identity/ui/backup-link-flow';
import type { LinkedOutcome } from '@/contexts/identity/ui/backup-link-flow.constants';
import { translator } from '@/i18n';
import { usePalette } from '@/ui-kit/theme';

/**
 * Info › Cloud backup › "Email me a code" on a local profile (mock admin, demo; decision LP1):
 * Identity links the profile's own account with the e-mailed code, then Cloud Backup decides
 * (`afterLinkPlan`, from the status read right then):
 * - off with nothing pending: the Turfer came to turn it on (consent `cloud-sync` only; Apple
 *   Health stays a separate switch), the first run starts, back to Info;
 * - on already (opened by password, LP2): a run, back to Info;
 * - turned off while it had no credentials: a run delivers that withdrawal (the server deletes its
 *   copy) and backup stays off; never turned back on from here.
 */
export default function LinkBackupScreen() {
  const p = usePalette();
  const { status, current, setEnabled, backUpNow } = useCloudBackup();

  const onLinked = async (): Promise<LinkedOutcome> => {
    const te = translator('errors');
    try {
      const plan = afterLinkPlan(await current());
      if (plan === 'deliver-withdrawal') {
        await backUpNow();
        return { kind: 'stayed-off' };
      }
      if (plan === 'resume') {
        void backUpNow();
      } else {
        const r = await setEnabled(true); // also starts the first upload
        if (r.kind === 'failed') {
          return { kind: 'failed', message: te(ERROR_KEY[r.error]) };
        }
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
        turnsOn={status ? afterLinkPlan(status) === 'enable' : true}
      />
    </ScrollView>
  );
}
