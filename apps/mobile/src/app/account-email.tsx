import { SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { EmailChangeFlow } from '@/contexts/identity/ui/email-change-flow';
import { usePalette } from '@/ui-kit/theme';

/** Me › Account › Email: code to the current address → new address → code from the new inbox. */
export default function AccountEmailScreen() {
  const p = usePalette();
  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: SPACE.lg }}
      keyboardShouldPersistTaps='handled'
      automaticallyAdjustKeyboardInsets
    >
      <EmailChangeFlow onDone={() => router.back()} />
    </ScrollView>
  );
}
