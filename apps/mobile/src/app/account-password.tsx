import { SPACE } from '@cityturfer/brand';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { PASSWORD_COPY, type PasswordAction } from '@/contexts/identity/ui/account-settings.constants';
import { PasswordFlow } from '@/contexts/identity/ui/password-flow';
import { usePalette } from '@/ui-kit/theme';

const ACTIONS: readonly PasswordAction[] = ['set', 'change', 'remove'];

/** Me › Account › Account password: `?action=set|change|remove`, each after a code to the current address. */
export default function AccountPasswordScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{ action?: string }>();
  const action = ACTIONS.find((a) => a === params.action) ?? 'set';
  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: SPACE.lg }}
      keyboardShouldPersistTaps='handled'
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: PASSWORD_COPY.save[action] }} />
      <PasswordFlow action={action} onDone={() => router.back()} />
    </ScrollView>
  );
}
