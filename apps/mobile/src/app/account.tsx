import { SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { useCloudBackup } from '@/contexts/cloud-backup/ui/hooks';
import { AccountOverview } from '@/contexts/identity/ui/account-overview';
import { PASSWORD_COPY } from '@/contexts/identity/ui/account-settings.constants';
import { useAccountSettings } from '@/contexts/identity/ui/hooks';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

const RECORDING = ['Recording in progress', 'Finish or discard your recording first.'] as const;

const choose = <T extends string>(
  title: string,
  text: string,
  options: { text: string; value: T; destructive?: boolean }[]
) =>
  new Promise<T | null>((resolve) =>
    Alert.alert(title, text, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ...options.map((o) => ({
        text: o.text,
        style: o.destructive ? ('destructive' as const) : ('default' as const),
        onPress: () => resolve(o.value),
      })),
    ])
  );

export default function AccountScreen() {
  const p = usePalette();
  const { auth, signOut, deleteAccount, requestDataExport } = useApp();
  const { status, backUpNow } = useCloudBackup();
  const [busy, setBusy] = useState<string | null>(null);
  const user = auth.status === 'signed-in' ? auth.user : null;
  const hasAccount = user?.accountId != null;

  const settings = useAccountSettings();
  const dataText = status?.enabled
    ? `On this phone, backed up (${status.backedUp} of ${status.total})`
    : 'Stored on this phone only';

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
    const action = await choose(PASSWORD_COPY.actionTitle, PASSWORD_COPY.actionText, [
      { text: PASSWORD_COPY.change, value: 'change' },
      { text: PASSWORD_COPY.remove, value: 'remove', destructive: true },
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
      Alert.alert('Something went wrong', 'Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const onSignOut = () =>
    busyWhile('sign-out', async () => {
      if (status?.enabled && status.unsynced > 0) {
        const n = status.unsynced;
        const answer = await choose(
          'Not everything is backed up',
          `${n} ${n === 1 ? 'activity has' : 'activities have'} changes that aren't on the server yet. They stay on this phone either way.`,
          [
            { text: 'Back up now', value: 'backup' },
            { text: 'Sign out anyway', value: 'sign-out', destructive: true },
          ]
        );
        if (answer === 'backup') {
          await backUpNow();
          return;
        }
        if (answer !== 'sign-out') {
          return;
        }
      }
      if ((await signOut()) === 'recording-in-progress') {
        Alert.alert(...RECORDING);
      }
    });

  const onExport = () =>
    busyWhile('export', async () => {
      const r = await requestDataExport();
      const text: Record<string, [string, string]> = {
        requested: ['On its way', `We'll email a download link to ${user?.email}. It works once, for 24 hours.`],
        'rate-limited': ['Already sent today', 'You can ask for one export a day. Check your email for the last link.'],
        'no-email': [
          'No email address',
          'This account has no email to send the link to. Sign in with your email first.',
        ],
        offline: ['No connection', 'Try again when you’re online.'],
        auth: ['Signed out on the server', 'Sign in again, then ask for your export.'],
        'not-signed-in': [
          'Sign in again',
          'This phone isn’t signed in to your account any more. Sign out, sign in with your email, then ask for your export.',
        ],
      };
      Alert.alert(...(text[r.kind] ?? ['Something went wrong', 'Try again in a moment.']));
    });

  const onDelete = () =>
    busyWhile('delete', async () => {
      const sure = await choose(
        'Delete your account?',
        'Your account and everything on our server (backup, consents, exports) is deleted for good. This can’t be undone.',
        [{ text: 'Delete account', value: 'yes', destructive: true }]
      );
      if (!sure) {
        return;
      }
      const local =
        user?.id === 'admin'
          ? 'Keep your activities and turf here, or delete them too? Deleting also removes this phone’s history from before the account (the local admin profile uses the same data).'
          : 'Keep your activities and turf here, or delete them too?';
      const keep = await choose('And on this phone?', local, [
        { text: 'Keep on this phone', value: 'keep' },
        { text: 'Delete from this phone', value: 'delete', destructive: true },
      ]);
      if (!keep) {
        return;
      }
      const r = await deleteAccount(keep === 'keep');
      if (r.kind === 'recording-in-progress') {
        Alert.alert(...RECORDING);
      } else if (r.kind === 'auth') {
        Alert.alert(
          'Sign in again',
          'Your sign-in has expired. Nothing was deleted. Sign out, sign in with your email, then delete your account.'
        );
      } else if (r.kind === 'not-signed-in') {
        // The account's sign-in didn't come along (e.g. a restored or migrated iPhone): no request was sent.
        Alert.alert(
          'Sign in again',
          'This phone isn’t signed in to your account any more. Nothing was deleted. Sign out, sign in with your email, then delete your account.'
        );
      } else if (r.kind === 'ok-local-pending') {
        Alert.alert(
          'Account deleted',
          'Your account is deleted. This phone’s copy of your activities couldn’t be deleted just now; CityTurfer deletes it the next time it opens.'
        );
      } else if (r.kind === 'offline') {
        Alert.alert('No connection', 'Nothing was deleted. Try again when you’re online.');
      } else if (r.kind !== 'ok') {
        Alert.alert('Could not delete', 'Nothing was deleted. Try again in a moment.');
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
        label='Sign out'
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
            label='Export my data'
            color={p.border}
            textColor={p.text}
            busy={busy === 'export'}
            disabled={busy != null}
            onPress={onExport}
          />
          <Button
            testID='account-delete'
            label='Delete account'
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
