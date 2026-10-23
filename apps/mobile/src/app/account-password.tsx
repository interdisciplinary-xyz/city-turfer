import { FONT_SIZE, SPACE } from '@cityturfer/brand';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccountGate } from '@/contexts/identity/ui/account-gate';
import { PasswordFlow } from '@/contexts/identity/ui/password-flow';
import { passwordActionFor } from '@/contexts/identity/ui/password-steps';
import { useAnnounce } from '@/contexts/identity/ui/use-announce';
import { useT } from '@/i18n';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

/**
 * The flow for the account's password state. `?action=remove` only asks to remove it; set or change
 * comes from the server's `hasPassword`, decided once when the screen opens (a refresh mid-flow
 * never switches it).
 */
function PasswordScreen({ requested, hasPassword }: { requested: string | undefined; hasPassword: boolean }) {
  const p = usePalette();
  const t = useT('account');
  const tc = useT('common');
  const [action] = useState(() => passwordActionFor(requested, hasPassword));
  useAnnounce(action === 'nothing-to-remove' && t('gate.noPassword'));
  if (action === 'nothing-to-remove') {
    return (
      <View style={{ gap: SPACE.lg }}>
        <Text testID='account-password-none' accessibilityLiveRegion='polite' style={[s.text, { color: p.text }]}>
          {t('gate.noPassword')}
        </Text>
        <Button
          testID='account-gate-back'
          label={tc('back')}
          color={p.border}
          textColor={p.text}
          onPress={() => router.back()}
        />
      </View>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: t(`passwordSave.${action}`) }} />
      <PasswordFlow action={action} onDone={() => router.back()} />
    </>
  );
}

/** Me › Account › Account password: set, change or remove, each after a code to the current address. */
export default function AccountPasswordScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{ action?: string }>();
  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: SPACE.lg }}
      keyboardShouldPersistTaps='handled'
      automaticallyAdjustKeyboardInsets
    >
      <AccountGate>
        {(account) => <PasswordScreen requested={params.action} hasPassword={account.hasPassword} />}
      </AccountGate>
    </ScrollView>
  );
}

const s = StyleSheet.create({ text: { fontSize: FONT_SIZE.body } });
