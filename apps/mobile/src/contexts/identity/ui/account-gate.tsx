import { FONT_SIZE, SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { type AccountGateProps, type AccountReady, GATE_COPY, RETRY, VALUE } from './account-settings.constants';
import { unreachableText } from './account-settings-state';
import { useAccountSettings } from './hooks';
import { useAnnounce } from './use-announce';

/**
 * Opens an account flow (email, password) only for a signed-in account, from the server's fresh
 * answer, whatever the route was opened with: a local profile, no connection or a lost sign-in get
 * a short note and a way back instead of a flow that can only fail. Once open, the flow stays
 * open: a later refresh never unmounts it halfway through.
 */
export function AccountGate({ children }: AccountGateProps) {
  const p = usePalette();
  const { state, refresh } = useAccountSettings();
  const checking =
    state.status === 'loading' ||
    (state.status === 'ready' && state.refreshing === true) ||
    ((state.status === 'offline' || state.status === 'failed') && state.retrying === true);
  const blocked = unreachableText(state);
  const note = checking
    ? null
    : state.status === 'ready' && state.settings.kind === 'local'
      ? GATE_COPY.local
      : blocked;
  useAnnounce(note);
  const [opened, setOpened] = useState<AccountReady | null>(null);
  const fresh = !checking && state.status === 'ready' && state.settings.kind === 'account' ? state.settings : null;
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
      label={GATE_COPY.back}
      color={p.border}
      textColor={p.text}
      onPress={() => router.back()}
    />
  );
  if (checking) {
    return (
      <Text testID='account-gate-checking' accessibilityLiveRegion='polite' style={[s.text, { color: p.muted }]}>
        {VALUE.checking}
      </Text>
    );
  }
  return (
    <View style={s.root}>
      <Text testID='account-gate-note' accessibilityLiveRegion='polite' style={[s.text, { color: p.text }]}>
        {note}
      </Text>
      {blocked && <Button testID='account-gate-retry' label={RETRY} color={ACCENT} onPress={() => void refresh()} />}
      {back}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: SPACE.lg },
  text: { fontSize: FONT_SIZE.body },
});
