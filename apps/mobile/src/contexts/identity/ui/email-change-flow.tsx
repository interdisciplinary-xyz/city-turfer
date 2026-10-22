import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { accountFieldError, newEmail } from '@/contexts/identity';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { AccountField } from './account-field';
import {
  CODE_COPY,
  EMAIL_COPY,
  type EmailChangeFlowProps,
  failureText,
  FIELD_ERROR_TEXT,
  INVALID_CODE,
} from './account-settings.constants';
import type { EmailChangeStep } from './email-change-flow.constants';
import { useAccountActions, useSubmit } from './hooks';

/** The shared rule's message for the new address; `invalid` only once the Turfer tried to send. */
function problemOf(draft: string, current: string, tried: boolean): string | null {
  try {
    newEmail(draft, current);
    return null;
  } catch (e) {
    const code = accountFieldError(e);
    if (!code || (code === 'email.invalid' && !tried)) {
      return null;
    }
    return FIELD_ERROR_TEXT[code];
  }
}

/**
 * Change the email in three steps (contract 0.5.0): a code to the current address proves it's
 * you; the new address gets its own code; that code makes the change. The step-up code is only
 * checked with step 2, so a wrong one sends the Turfer back to step 1's field.
 */
export function EmailChangeFlow({ onDone }: EmailChangeFlowProps) {
  const p = usePalette();
  const { auth } = useApp();
  const current = auth.status === 'signed-in' ? auth.user.email : '';
  const actions = useAccountActions();
  const { busy, error, setError, run } = useSubmit();
  const [step, setStep] = useState<EmailChangeStep>('start');
  const [stepUpCode, setStepUpCode] = useState('');
  const [draft, setDraft] = useState('');
  const [tried, setTried] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const fieldRef = useRef<TextInput>(null);
  const focusSoon = () => setTimeout(() => fieldRef.current?.focus(), 50);
  const problem = problemOf(draft, current, tried);

  const sendStepUp = () =>
    run(async () => {
      const r = await actions.requestStepUpCode();
      if (r.kind !== 'sent') {
        return failureText(r);
      }
      setStepUpCode('');
      setStep('current-code');
      focusSoon();
    });

  const toNewEmail = () => {
    if (!stepUpCode.trim()) {
      setError(INVALID_CODE);
      return;
    }
    setError(null);
    setStep('new-email');
    focusSoon();
  };

  const sendToNew = () =>
    run(async () => {
      setTried(true);
      if (problemOf(draft, current, true)) {
        return null;
      }
      const r = await actions.requestEmailChange(draft, stepUpCode);
      switch (r.kind) {
        case 'sent':
          setSentTo(r.newEmail);
          setCode('');
          setStep('new-code');
          focusSoon();
          return null;
        case 'invalid-code':
          setStepUpCode('');
          setStep('current-code');
          return INVALID_CODE;
        case 'field-error':
          return FIELD_ERROR_TEXT[r.code];
        default:
          return failureText(r);
      }
    });

  const confirm = () =>
    run(async () => {
      const r = await actions.confirmEmailChange(sentTo, code);
      switch (r.kind) {
        case 'changed':
          setStep('done');
          return null;
        case 'invalid-code':
          return EMAIL_COPY.newInvalid(sentTo);
        case 'email-taken':
          return EMAIL_COPY.taken;
        case 'field-error':
          return FIELD_ERROR_TEXT[r.code];
        default:
          return failureText(r);
      }
    });

  const restart = () => {
    setStep('start');
    setStepUpCode('');
    setCode('');
    setError(null);
  };

  const text = (t: string, testID?: string) => (
    <Text testID={testID} style={[s.text, { color: p.text }]}>
      {t}
    </Text>
  );
  const link = (label: string, testID: string, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      style={s.linkTarget}
    >
      <Text style={[s.link, { color: p.accentText }]}>{label}</Text>
    </Pressable>
  );
  const errorText = error && (
    <Text testID='account-email-error' accessibilityLiveRegion='polite' style={[s.error, { color: p.danger }]}>
      {error}
    </Text>
  );

  if (step === 'done') {
    return (
      <View style={s.root}>
        {text(EMAIL_COPY.done(sentTo), 'account-email-done-text')}
        <Button testID='account-email-done' label={EMAIL_COPY.doneButton} color={ACCENT} onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {step === 'start' && (
        <>
          {text(EMAIL_COPY.intro(current))}
          {errorText}
          <Button
            testID='account-email-send-code'
            label={CODE_COPY.sendCode}
            color={ACCENT}
            busy={busy}
            onPress={() => void sendStepUp()}
          />
        </>
      )}
      {step === 'current-code' && (
        <>
          {text(EMAIL_COPY.currentSent(current), 'account-email-current-sent')}
          <AccountField
            ref={fieldRef}
            testID='account-email-current-code'
            label={CODE_COPY.label}
            code
            value={stepUpCode}
            onChangeText={setStepUpCode}
            onSubmitEditing={toNewEmail}
            returnKeyType='next'
          />
          {errorText}
          <Button
            testID='account-email-current-continue'
            label={CODE_COPY.continue}
            color={ACCENT}
            disabled={!stepUpCode.trim()}
            onPress={toNewEmail}
          />
          {link(CODE_COPY.resend, 'account-email-resend-current', () => void sendStepUp())}
        </>
      )}
      {step === 'new-email' && (
        <>
          <AccountField
            ref={fieldRef}
            testID='account-email-new'
            label={EMAIL_COPY.newLabel}
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              setError(null);
            }}
            onSubmitEditing={() => void sendToNew()}
            autoCapitalize='none'
            autoComplete='email'
            keyboardType='email-address'
            autoCorrect={false}
            spellCheck={false}
            textContentType='emailAddress'
            returnKeyType='send'
            editable={!busy}
            error={problem}
            hint={EMAIL_COPY.newHint}
          />
          {errorText}
          <Button
            testID='account-email-send-new'
            label={EMAIL_COPY.sendNew}
            color={ACCENT}
            busy={busy}
            disabled={!draft.trim() || problem != null}
            onPress={() => void sendToNew()}
          />
        </>
      )}
      {step === 'new-code' && (
        <>
          {text(EMAIL_COPY.newSent(sentTo), 'account-email-new-sent')}
          <AccountField
            ref={fieldRef}
            testID='account-email-new-code'
            label={CODE_COPY.label}
            code
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => void confirm()}
            returnKeyType='go'
            editable={!busy}
          />
          {errorText}
          <Button
            testID='account-email-confirm'
            label={EMAIL_COPY.confirm}
            color={ACCENT}
            busy={busy}
            disabled={!code.trim()}
            onPress={() => void confirm()}
          />
          {/* A new code for the new inbox needs a fresh code to the current one: start again. */}
          {link(EMAIL_COPY.restart, 'account-email-restart', restart)}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: SPACE.lg },
  text: { fontSize: FONT_SIZE.body },
  error: { fontSize: FONT_SIZE.caption },
  link: { fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
});
