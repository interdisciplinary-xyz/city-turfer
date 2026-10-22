import { SPACE } from '@cityturfer/brand';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { NameForm } from '@/contexts/identity/ui/name-form';
import { usePalette } from '@/ui-kit/theme';

/** Me › Account › Name. */
export default function AccountNameScreen() {
  const p = usePalette();
  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: SPACE.lg }}
      keyboardShouldPersistTaps='handled'
      automaticallyAdjustKeyboardInsets
    >
      <NameForm onDone={() => router.back()} />
    </ScrollView>
  );
}
