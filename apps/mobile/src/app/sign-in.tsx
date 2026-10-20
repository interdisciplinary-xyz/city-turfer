import { NAME, RADIUS, SPACE, TAGLINE } from '@cityturfer/brand';
import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { ACCENT, DARK } from '@/constants/colors';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { useLightStatusBar } from '@/ui-kit/use-light-status-bar';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset; the app has no *.png type declarations.
const WORDMARK = require('../../assets/brand/out/wordmark.png');

export default function SignIn() {
  useLightStatusBar();
  const { signIn } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await signIn(email, password).catch(() => 'invalid' as const);
    setBusy(false);
    if (r === 'invalid') {
      setError('Wrong email or password.');
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <Image
          source={WORDMARK}
          style={s.logo}
          resizeMode='contain'
          accessible
          accessibilityRole='image'
          accessibilityLabel={NAME}
        />
        <Text style={s.tag}>{TAGLINE}</Text>
        <TextInput
          testID='sign-in-email'
          style={s.input}
          placeholder='Email'
          placeholderTextColor={DARK.muted}
          autoCapitalize='none'
          autoComplete='email'
          keyboardType='email-address'
          autoCorrect={false}
          spellCheck={false}
          textContentType='username'
          returnKeyType='next'
          submitBehavior='submit'
          onSubmitEditing={() => passwordRef.current?.focus()}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          ref={passwordRef}
          testID='sign-in-password'
          style={s.input}
          placeholder='Password'
          placeholderTextColor={DARK.muted}
          secureTextEntry
          autoCorrect={false}
          textContentType='password'
          returnKeyType='go'
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        {error && (
          <Text testID='sign-in-error' style={s.error}>
            {error}
          </Text>
        )}
        <Button
          testID='sign-in-submit'
          label='Sign in'
          color={ACCENT}
          onPress={submit}
          busy={busy}
          disabled={!email || !password}
        />
        <Text style={s.note}>Proof of concept · demo account only</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK.bg },
  inner: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  // Outlined wordmark for dark backgrounds (packages/brand/svg/wordmark.svg, rendered to 1102 × 192).
  logo: { width: '100%', maxWidth: 280, height: undefined, aspectRatio: 1102 / 192, alignSelf: 'center' },
  tag: { color: DARK.muted, textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: DARK.card,
    color: DARK.text,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACE.lg,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  error: { color: DARK.danger, textAlign: 'center' },
  note: { color: DARK.muted, textAlign: 'center', fontSize: 12, marginTop: 8 },
});
