import { SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { useCloudBackup } from '@/contexts/cloud-backup/ui/hooks';
import { AccountOverview } from '@/contexts/identity/ui/account-overview';
import { useAccountSettings } from '@/contexts/identity/ui/hooks';
import { translator, useT } from '@/i18n';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

/** "Recording in progress": signing out or deleting waits for the recording (worded when shown). */
const alertRecording = () => {
  const t = translator('account');
  Alert.alert(t('screen.recordingTitle'), t('screen.recordingText'));
};

const choose = <T extends string>(
  title: string,
  text: string,
  options: { text: string; value: T; destructive?: boolean }[]
) =>
  new Promise<T | null>((resolve) =>
    Alert.alert(title, text, [
      { text: translator('common')('cancel'), style: 'cancel', onPress: () => resolve(null) },
      ...options.map((o) => ({
        text: o.text,
        style: o.destructive ? ('destructive' as const) : ('default' as const),
        onPress: () => resolve(o.value),
      })),
    ])
  );

/** The data export's answer as an alert: [title, text] keys in `account`. */
const EXPORT_ALERT = {
  requested: ['export.requestedTitle', 'export.requestedText'],
  'rate-limited': ['export.rateLimitedTitle', 'export.rateLimitedText'],
  'no-email': ['export.noEmailTitle', 'export.noEmailText'],
  offline: ['export.offlineTitle', 'export.offlineText'],
  auth: ['export.authTitle', 'export.authText'],
  'not-signed-in': ['export.notSignedInTitle', 'export.notSignedInText'],
} as const;

export default function AccountScreen() {
  const p = usePalette();
  const t = useT('account');
  const { auth, signOut, deleteAccount, requestDataExport } = useApp();
  const { status, backUpNow } = useCloudBackup();
  const [busy, setBusy] = useState<string | null>(null);
  const user = auth.status === 'signed-in' ? auth.user : null;
  const hasAccount = user?.accountId != null;

  const settings = useAccountSettings();
  const dataText = status?.enabled
    ? t('screen.dataBackedUp', { backedUp: status.backedUp, total: status.total })
    : t('screen.dataLocal');

  /** Not set: straight to "Set"; set: change it or remove it. Each flow asks for a code first. */
  const onPassword = async () => {
    const s = settings.state;
    if (s.status !== 'ready' || s.refreshing || s.settings.kind !== 'account') {
      return; // not answered yet, or asked again: `hasPassword` may be out of date
    }
    if (!s.settings.hasPassword) {
      router.push('/account-password?action=set');
      return;
    }
    const ta = translator('account');
    const action = await choose(ta('password.actionTitle'), ta('password.actionText'), [
      { text: ta('password.change'), value: 'change' },
      { text: ta('password.remove'), value: 'remove', destructive: true },
    ]);
    if (action) {
      router.push(`/account-password?action=${action}`);
    }
  };

  const busyWhile = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    try {
      await work();
    } catch {
      const ta = translator('account');
      Alert.alert(ta('screen.failedTitle'), ta('screen.failedText'));
    } finally {
      setBusy(null);
    }
  };

  const onSignOut = () =>
    busyWhile('sign-out', async () => {
      if (status?.enabled && status.unsynced > 0) {
        const ta = translator('account');
        const answer = await choose(ta('screen.unsyncedTitle'), ta('screen.unsyncedText', { count: status.unsynced }), [
          { text: ta('screen.backUpNow'), value: 'backup' },
          { text: ta('screen.signOutAnyway'), value: 'sign-out', destructive: true },
        ]);
        if (answer === 'backup') {
          await backUpNow();
          return;
        }
        if (answer !== 'sign-out') {
          return;
        }
      }
      if ((await signOut()) === 'recording-in-progress') {
        alertRecording();
      }
    });

  const onExport = () =>
    busyWhile('export', async () => {
      const r = await requestDataExport();
      const ta = translator('account');
      const keys = r.kind in EXPORT_ALERT ? EXPORT_ALERT[r.kind as keyof typeof EXPORT_ALERT] : null;
      if (!keys) {
        Alert.alert(ta('screen.failedTitle'), ta('screen.failedText'));
      } else {
        Alert.alert(ta(keys[0]), ta(keys[1], { email: user?.email ?? '' }));
      }
    });

  const onDelete = () =>
    busyWhile('delete', async () => {
      const ta = translator('account');
      const sure = await choose(ta('delete.confirmTitle'), ta('delete.confirmText'), [
        { text: ta('delete.confirm'), value: 'yes', destructive: true },
      ]);
      if (!sure) {
        return;
      }
      const local = user?.id === 'admin' ? ta('delete.localTextAdmin') : ta('delete.localText');
      const keep = await choose(ta('delete.localTitle'), local, [
        { text: ta('delete.keep'), value: 'keep' },
        { text: ta('delete.deleteLocal'), value: 'delete', destructive: true },
      ]);
      if (!keep) {
        return;
      }
      const r = await deleteAccount(keep === 'keep');
      if (r.kind === 'recording-in-progress') {
        alertRecording();
      } else if (r.kind === 'auth') {
        Alert.alert(ta('delete.authTitle'), ta('delete.authText'));
      } else if (r.kind === 'not-signed-in') {
        // The account's sign-in didn't come along (e.g. a restored or migrated iPhone): no request was sent.
        Alert.alert(ta('delete.notSignedInTitle'), ta('delete.notSignedInText'));
      } else if (r.kind === 'ok-local-pending') {
        Alert.alert(ta('delete.localPendingTitle'), ta('delete.localPendingText'));
      } else if (r.kind === 'offline') {
        Alert.alert(ta('delete.offlineTitle'), ta('delete.offlineText'));
      } else if (r.kind !== 'ok') {
        Alert.alert(ta('delete.failedTitle'), ta('delete.failedText'));
      }
    });

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ padding: SPACE.lg, gap: 14 }}>
      {user && (
        <AccountOverview
          user={user}
          state={settings.state}
          dataText={dataText}
          onName={() => router.push('/account-name')}
          onEmail={() => router.push('/account-email')}
          onPassword={() => void onPassword()}
          onRetry={() => void settings.refresh()}
        />
      )}
      <Button
        testID='sign-out'
        label={t('screen.signOut')}
        color={p.border}
        textColor={p.text}
        busy={busy === 'sign-out'}
        disabled={busy != null}
        onPress={onSignOut}
      />
      {hasAccount && (
        <>
          <Button
            testID='account-export'
            label={t('screen.export')}
            color={p.border}
            textColor={p.text}
            busy={busy === 'export'}
            disabled={busy != null}
            onPress={onExport}
          />
          <Button
            testID='account-delete'
            label={t('screen.delete')}
            color={p.border}
            textColor={p.danger}
            busy={busy === 'delete'}
            disabled={busy != null}
            onPress={onDelete}
          />
        </>
      )}
    </ScrollView>
  );
}
