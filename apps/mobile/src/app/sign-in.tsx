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
import { waitText } from '@/contexts/identity/ui/account-settings.constants';
import {
  emailEditRestarts,
  onEmailSubmit,
  switchSignIn,
  wrongPasswordText,
} from '@/contexts/identity/ui/sign-in-steps';
import type { SignInStep } from '@/contexts/identity/ui/sign-in-steps.constants';
import { useAnnounce } from '@/contexts/identity/ui/use-announce';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { useLightStatusBar } from '@/ui-kit/use-light-status-bar';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset; the app has no *.png type declarations.
const WORDMARK = require('../../assets/brand/out/wordmark.png');

/** Why a request to the account server failed, in plain words. */
function failureText(f: AccountFailure | { kind: 'accounts-unavailable' }): string {
  switch (f.kind) {
    case 'rate-limited':
      return f.retryAfterS
        ? `Too many tries. Wait ${waitText(f.retryAfterS)} and try again.`
        : 'Too many tries. Wait a few minutes and try again.';
    case 'offline':
      return 'No connection. Signing in needs the internet once; after that the app works offline.';
    case 'accounts-unavailable':
      return 'Signing in to an account is not available in this build.';
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
 * email gets a 6-digit code by email (which also creates the account on first use). "Use a password
 * instead" signs an account in with its optional account password; the code stays the default.
 */
export default function SignIn() {
  useLightStatusBar();
  const { signInWithPassword, startSignIn, verifyCode, chooseHistory } = useApp();
  const [step, setStep] = useState<SignInStep>('email');
  /** The Turfer chose "Use a password instead" (not a local profile's own password step). */
  const [chosePassword, setChosePassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // VoiceOver hears the error (TalkBack reads its live region).
  useAnnounce(error);
  const emailRef = useRef<TextInput>(null);
  const secondRef = useRef<TextInput>(null);
  // A ref, not the state: a second keyboard submit in the same frame must see the first one.
  const inFlight = useRef(false);

  const busyWhile = async (work: () => Promise<void>) => {
    if (inFlight.current) {
      return; // a double tap on Go: the code is sent (or checked) once
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      inFlight.current = false;
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
      const r = await signInWithPassword(email, password);
      if (r.kind === 'choose-history') {
        if ((await chooseHistory(await askHistory())) === 'no-pending') {
          setPassword('');
          setError('That took a while. Sign in again.');
        }
      } else if (r.kind === 'invalid-credentials') {
        setError(wrongPasswordText(chosePassword));
      } else if (r.kind === 'linked-to-account') {
        setError('This phone’s history now belongs to your CityTurfer account. Sign in with that account’s email.');
      } else if (r.kind === 'invalid-email') {
        setError('That doesn’t look like an email address.');
      } else if (r.kind !== 'ok') {
        setError(failureText(r));
      }
    });

  const switchToPassword = (on: boolean) => {
    const next = switchSignIn(on, email);
    setChosePassword(next.chosePassword);
    setStep(next.step);
    setPassword('');
    setCode('');
    setError(null);
    if (next.focus) {
      // The email first while it's empty; the password field mounts with this render.
      setTimeout(() => (next.focus === 'email' ? emailRef : secondRef).current?.focus(), 50);
    }
  };

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
    if (emailEditRestarts(step, chosePassword)) {
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
          ref={emailRef}
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
          onSubmitEditing={
            onEmailSubmit(chosePassword) === 'focus-password' ? () => secondRef.current?.focus() : submitEmail
          }
          value={email}
          onChangeText={editEmail}
        />
        {step === 'password' && (
          <TextInput
            ref={secondRef}
            testID='sign-in-password'
            style={s.input}
            placeholder={chosePassword ? 'Account password' : 'Password'}
            accessibilityLabel={chosePassword ? 'Account password' : 'Password'}
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
          <Text testID='sign-in-error' accessibilityLiveRegion='polite' style={s.error}>
            {error}
          </Text>
        )}
        {step === 'email' && (
          <>
            <Button
              testID='sign-in-continue'
              label='Continue'
              color={ACCENT}
              onPress={submitEmail}
              busy={busy}
              disabled={!email.trim()}
            />
            <Pressable
              testID='sign-in-use-password'
              accessibilityRole='button'
              accessibilityLabel='Use a password instead'
              onPress={() => switchToPassword(true)}
              disabled={busy}
              style={s.linkTarget}
            >
              <Text style={s.link}>Use a password instead</Text>
            </Pressable>
          </>
        )}
        {step === 'password' && (
          <>
            <Button
              testID='sign-in-submit'
              label='Sign in'
              color={ACCENT}
              onPress={submitPassword}
              busy={busy}
              disabled={!password || !email.trim()}
            />
            {chosePassword && (
              <Pressable
                testID='sign-in-use-code'
                accessibilityRole='button'
                accessibilityLabel='Use an email code instead'
                onPress={() => switchToPassword(false)}
                disabled={busy}
                style={s.linkTarget}
              >
                <Text style={s.link}>Use an email code instead</Text>
              </Pressable>
            )}
          </>
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
  // Outlined wordmark for dark backgrounds (packages/brand/svg/wordmark.svg, rendered to 894 × 192).
  logo: { width: '100%', maxWidth: 230, height: undefined, aspectRatio: 894 / 192, alignSelf: 'center' },
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
