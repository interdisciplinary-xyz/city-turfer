import { NAME, RADIUS, SPACE, TAGLINE } from '@cityturfer/brand';
import { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ACCENT, DARK } from '@/constants/colors';
import type { AccountFailure } from '@/contexts/identity';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { useLightStatusBar } from '@/ui-kit/use-light-status-bar';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset; the app has no *.png type declarations.
const WORDMARK = require('../../assets/brand/out/wordmark.png');

type Step = 'email' | 'password' | 'code';

/** Why a request to the account server failed, in plain words. */
function failureText(f: AccountFailure | { kind: 'accounts-unavailable' }): string {
  switch (f.kind) {
    case 'rate-limited':
      return f.retryAfterS
        ? `Too many tries. Wait ${Math.max(1, Math.ceil(f.retryAfterS / 60))} min and try again.`
        : 'Too many tries. Wait a few minutes and try again.';
    case 'offline':
      return 'No connection. Signing in with a code needs the internet once; after that the app works offline.';
    case 'accounts-unavailable':
      return 'Signing in with a code is not available in this build.';
    default:
      return 'Our server had a hiccup. Try again in a moment.';
  }
}

const askHistory = () =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      'Use this phone’s history?',
      'This phone already has activities and turf. Make them part of your account? Nothing is copied: they stay right here, now with your account.',
      [
        { text: 'Keep apart', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Use them', onPress: () => resolve(true) },
      ]
    )
  );

/**
 * Sign in: the email first. The local profiles (admin, demo) then ask for their password; any other
 * email gets a 6-digit code by email (which also creates the account on first use).
 */
export default function SignIn() {
  useLightStatusBar();
  const { signIn, startSignIn, verifyCode, chooseHistory } = useApp();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const secondRef = useRef<TextInput>(null);

  const busyWhile = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () =>
    busyWhile(async () => {
      const r = await startSignIn(email);
      if (r.kind === 'password' || r.kind === 'code-sent') {
        setStep(r.kind === 'password' ? 'password' : 'code');
        setTimeout(() => secondRef.current?.focus(), 50);
      } else if (r.kind === 'invalid-email') {
        setError('That doesn’t look like an email address.');
      } else {
        setError(failureText(r));
      }
    });

  const submitPassword = () =>
    busyWhile(async () => {
      const r = await signIn(email, password);
      if (r === 'invalid') {
        setError('Wrong email or password.');
      } else if (r === 'linked-to-account') {
        setError('This phone’s history now belongs to your CityTurfer account. Sign in with that account’s email.');
      }
    });

  const submitCode = () =>
    busyWhile(async () => {
      const r = await verifyCode(email, code);
      if (r.kind === 'choose-history') {
        if ((await chooseHistory(await askHistory())) === 'no-pending') {
          setStep('email');
          setCode('');
          setError('That took a while. Send a new code and sign in again.');
        }
      } else if (r.kind === 'invalid-code') {
        setError('That code didn’t work. Check the latest email, or send a new code.');
      } else if (r.kind === 'invalid-email') {
        setError('That doesn’t look like an email address.');
      } else if (r.kind !== 'ok') {
        setError(failureText(r));
      }
    });

  const editEmail = (text: string) => {
    setEmail(text);
    if (step !== 'email') {
      setStep('email'); // another email: start again
      setPassword('');
      setCode('');
      setError(null);
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
          onSubmitEditing={submitEmail}
          value={email}
          onChangeText={editEmail}
        />
        {step === 'password' && (
          <TextInput
            ref={secondRef}
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
            onSubmitEditing={submitPassword}
          />
        )}
        {step === 'code' && (
          <>
            <Text testID='sign-in-code-sent' style={s.hint}>
              We emailed a 6-digit code to {email.trim()}. It works for 10 minutes.
            </Text>
            <TextInput
              ref={secondRef}
              testID='sign-in-code'
              style={[s.input, s.code]}
              placeholder='Code'
              placeholderTextColor={DARK.muted}
              keyboardType='number-pad'
              textContentType='oneTimeCode'
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
              maxLength={8}
              returnKeyType='go'
              value={code}
              onChangeText={setCode}
              onSubmitEditing={submitCode}
            />
          </>
        )}
        {error && (
          <Text testID='sign-in-error' style={s.error}>
            {error}
          </Text>
        )}
        {step === 'email' && (
          <Button
            testID='sign-in-continue'
            label='Continue'
            color={ACCENT}
            onPress={submitEmail}
            busy={busy}
            disabled={!email.trim()}
          />
        )}
        {step === 'password' && (
          <Button
            testID='sign-in-submit'
            label='Sign in'
            color={ACCENT}
            onPress={submitPassword}
            busy={busy}
            disabled={!password}
          />
        )}
        {step === 'code' && (
          <>
            <Button
              testID='sign-in-verify'
              label='Sign in'
              color={ACCENT}
              onPress={submitCode}
              busy={busy}
              disabled={!code.trim()}
            />
            <Pressable
              testID='sign-in-resend'
              accessibilityRole='button'
              onPress={submitEmail}
              disabled={busy}
              style={s.linkTarget}
            >
              <Text style={s.link}>Send a new code</Text>
            </Pressable>
          </>
        )}
        <Text style={s.note}>Your activities stay on this phone. Cloud backup is optional.</Text>
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
  code: { fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  hint: { color: DARK.muted, textAlign: 'center' },
  error: { color: DARK.danger, textAlign: 'center' },
  link: { color: ACCENT, fontWeight: '700', textAlign: 'center', paddingVertical: SPACE.xs },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  note: { color: DARK.muted, textAlign: 'center', fontSize: 12, marginTop: 8 },
});
