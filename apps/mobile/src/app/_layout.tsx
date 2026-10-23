import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ACCENT, DARK, DISPLAY_CASE, DISPLAY_TRACKING, FONT_FAMILY } from '@/constants/colors';
import { I18nProvider, useLanguageSetting, useT } from '@/i18n';
import { AppProvider, useApp } from '@/ui-kit/app-context';
import { usePalette } from '@/ui-kit/theme';

function Gate() {
  const { auth } = useApp();
  const [language] = useLanguageSetting();
  const t = useT('nav');
  const back = useT('common')('back');
  const p = usePalette();
  // The saved language is read alongside the session, so the first screen never flashes in the wrong one.
  if (auth.status === 'loading' || !language.ready) {
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
        // Own Text: headerTitleStyle is merged over the platform's bold weight, and a brand font plus a
        // fontWeight falls back to the system font on Android.
        headerTitle: ({ children }) => (
          <Text
            accessibilityRole='header'
            numberOfLines={1}
            style={{
              color: p.text,
              fontFamily: FONT_FAMILY.display,
              fontSize: 22,
              lineHeight: 26,
              textTransform: DISPLAY_CASE,
              letterSpacing: DISPLAY_TRACKING,
            }}
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
          options={{ headerShown: true, title: t('screens.activity'), headerBackTitle: back }}
        />
        <Stack.Screen
          name='history'
          options={{ headerShown: true, title: t('screens.history'), headerBackTitle: back }}
        />
        <Stack.Screen
          name='profile'
          options={{ headerShown: true, title: t('screens.profile'), headerBackTitle: back }}
        />
        <Stack.Screen
          name='achievements'
          options={{ headerShown: true, title: t('screens.achievements'), headerBackTitle: back }}
        />
        <Stack.Screen
          name='account'
          options={{ headerShown: true, title: t('screens.account'), headerBackTitle: back }}
        />
        <Stack.Screen
          name='account-name'
          options={{ headerShown: true, title: t('screens.accountName'), headerBackTitle: back }}
        />
        <Stack.Screen
          name='account-email'
          options={{ headerShown: true, title: t('screens.accountEmail'), headerBackTitle: back }}
        />
        <Stack.Screen
          name='account-password'
          options={{ headerShown: true, title: t('screens.accountPassword'), headerBackTitle: back }}
        />
        <Stack.Screen name='info' options={{ headerShown: true, title: t('screens.info'), headerBackTitle: back }} />
        <Stack.Screen name='city' options={{ headerShown: true, title: t('screens.city'), headerBackTitle: back }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppProvider>
          <StatusBar style='auto' />
          <Gate />
        </AppProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
