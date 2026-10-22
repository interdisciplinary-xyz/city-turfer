import { SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { AccountGate } from '@/contexts/identity/ui/account-gate';
import { EmailChangeFlow } from '@/contexts/identity/ui/email-change-flow';
import { usePalette } from '@/ui-kit/theme';

/**
 * Me › Account › Email: code to the current address → new address → code from the new inbox. Only
 * for a signed-in account (the gate answers a local profile or a lost sign-in with a note).
 */
export default function AccountEmailScreen() {
  const p = usePalette();
  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: SPACE.lg }}
      keyboardShouldPersistTaps='handled'
      automaticallyAdjustKeyboardInsets
    >
      <AccountGate>{() => <EmailChangeFlow onDone={() => router.back()} />}</AccountGate>
    </ScrollView>
  );
}
