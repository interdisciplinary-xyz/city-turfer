import { FONT_SIZE, SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import type { AccountGateProps, AccountReady } from './account-settings.constants';
import { unreachableMessage } from './account-settings-state';
import { useAccountSettings, useBackupLinkTarget } from './hooks';
import { useAnnounce } from './use-announce';

/**
 * Opens an account flow (email, password) only for a signed-in account, from the server's fresh
 * answer, whatever the route was opened with: a local profile, no connection or a lost sign-in get
 * a short note and a way back instead of a flow that can only fail. Once open, the flow stays
 * open: a later refresh never unmounts it halfway through.
 */
export function AccountGate({ children }: AccountGateProps) {
  const p = usePalette();
  const t = useT('account');
  const tc = useT('common');
  const te = useT('errors');
  const { state, refresh } = useAccountSettings();
  // A local profile linked to its own address: its email and password are not changed here.
  const linkTarget = useBackupLinkTarget();
  const fixedAddress = linkTarget != null;
  const checking =
    linkTarget === undefined ||
    state.status === 'loading' ||
    (state.status === 'ready' && state.refreshing === true) ||
    ((state.status === 'offline' || state.status === 'failed') && state.retrying === true);
  const unreachable = unreachableMessage(state);
  const blocked = unreachable ? te(unreachable.key, unreachable.values) : null;
  const note = checking
    ? null
    : fixedAddress || (state.status === 'ready' && state.settings.kind === 'local')
      ? t('gate.local')
      : blocked;
  useAnnounce(note);
  const [opened, setOpened] = useState<AccountReady | null>(null);
  const fresh =
    !checking && !fixedAddress && state.status === 'ready' && state.settings.kind === 'account' ? state.settings : null;
  if (fresh && !opened) {
    setOpened(fresh); // derived state, set while rendering: the first fresh answer opens the flow
  }
  const account = opened ?? fresh;

  if (account) {
    return children(account);
  }
  const back = (
    <Button
      testID='account-gate-back'
      label={tc('back')}
      color={p.border}
      textColor={p.text}
      onPress={() => router.back()}
    />
  );
  if (checking) {
    return (
      <Text testID='account-gate-checking' accessibilityLiveRegion='polite' style={[s.text, { color: p.muted }]}>
        {t('value.checking')}
      </Text>
    );
  }
  return (
    <View style={s.root}>
      <Text testID='account-gate-note' accessibilityLiveRegion='polite' style={[s.text, { color: p.text }]}>
        {note}
      </Text>
      {blocked && !fixedAddress && (
        <Button testID='account-gate-retry' label={t('retry')} color={ACCENT} onPress={() => void refresh()} />
      )}
      {back}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: SPACE.lg },
  text: { fontSize: FONT_SIZE.body },
});
