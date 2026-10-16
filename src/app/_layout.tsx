import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/ui-kit/AppContext';
import { ACCENT, DARK } from '@/ui-kit/theme';

function Gate() {
  const { auth } = useApp();
  if (auth.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK.bg }}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }
  const signedIn = auth.status === 'signed-in';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name='sign-in' />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name='(tabs)' />
        <Stack.Screen
          name='activity/[id]'
          options={{ headerShown: true, title: 'Activity', headerBackTitle: 'Back' }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style='auto' />
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
