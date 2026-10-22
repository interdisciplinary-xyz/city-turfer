import { FONT_SIZE } from '@cityturfer/brand';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ACCENT, DARK, FONT_FAMILY } from '@/constants/colors';
import { AppProvider, useApp } from '@/ui-kit/app-context';
import { usePalette } from '@/ui-kit/theme';

function Gate() {
  const { auth } = useApp();
  const p = usePalette();
  if (auth.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK.bg }}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }
  const signedIn = auth.status === 'signed-in';
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: p.card },
        // Back button in the text colour: the glow accent fails contrast on the light header (3.3:1).
        headerTintColor: p.text,
        // Own Text: headerTitleStyle is merged over the platform's bold weight, and Archivo plus a
        // fontWeight falls back to the system font on Android.
        headerTitle: ({ children }) => (
          <Text
            accessibilityRole='header'
            numberOfLines={1}
            style={{ color: p.text, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lead }}
          >
            {children}
          </Text>
        ),
        contentStyle: { backgroundColor: p.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name='sign-in' />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name='(tabs)' />
        <Stack.Screen
          name='activity/[id]'
          options={{ headerShown: true, title: 'Activity', headerBackTitle: 'Back' }}
        />
        <Stack.Screen name='history' options={{ headerShown: true, title: 'History', headerBackTitle: 'Back' }} />
        <Stack.Screen name='profile' options={{ headerShown: true, title: 'Profile', headerBackTitle: 'Back' }} />
        <Stack.Screen
          name='achievements'
          options={{ headerShown: true, title: 'Achievements', headerBackTitle: 'Back' }}
        />
        <Stack.Screen name='account' options={{ headerShown: true, title: 'Account', headerBackTitle: 'Back' }} />
        <Stack.Screen name='account-name' options={{ headerShown: true, title: 'Name', headerBackTitle: 'Back' }} />
        <Stack.Screen name='account-email' options={{ headerShown: true, title: 'Email', headerBackTitle: 'Back' }} />
        <Stack.Screen
          name='account-password'
          options={{ headerShown: true, title: 'Account password', headerBackTitle: 'Back' }}
        />
        <Stack.Screen name='info' options={{ headerShown: true, title: 'Info', headerBackTitle: 'Back' }} />
        <Stack.Screen name='city' options={{ headerShown: true, title: 'Your city', headerBackTitle: 'Back' }} />
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
