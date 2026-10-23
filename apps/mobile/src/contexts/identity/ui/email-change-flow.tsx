import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { accountFieldError, newEmail } from '@/contexts/identity';
import { useT } from '@/i18n';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { AccountField } from './account-field';
import { type EmailChangeFlowProps, type ErrorMessage, FIELD_ERROR, INVALID_CODE } from './account-settings.constants';
import type { EmailChangeStep, EmailOutcome } from './email-change-flow.constants';
import { afterEmailChangeRequest, afterEmailConfirm, afterStepUpCode } from './email-change-steps';
import { useAccountActions, useSubmit } from './hooks';
import { useAnnounce } from './use-announce';

/** The shared rule's message for the new address; `invalid` only once the Turfer tried to send. */
function problemOf(draft: string, current: string, tried: boolean): ErrorMessage | null {
  try {
    newEmail(draft, current);
    return null;
  } catch (e) {
    const code = accountFieldError(e);
    if (!code || (code === 'email.invalid' && !tried)) {
      return null;
    }
    return FIELD_ERROR[code];
  }
}

/**
 * Change the email in three steps (contract 0.5.0): a code to the current address proves it's
 * you; the new address gets its own code; that code makes the change. The step-up code is only
 * checked with step 2, so a wrong one sends the Turfer back to step 1's field.
 */
export function EmailChangeFlow({ onDone }: EmailChangeFlowProps) {
  const p = usePalette();
  const t = useT('account');
  const tc = useT('common');
  const te = useT('errors');
  const { auth } = useApp();
  const current = auth.status === 'signed-in' ? auth.user.email : '';
  const actions = useAccountActions();
  const { busy, error: errorMessage, setError, run, refused, waiting } = useSubmit();
  const error = errorMessage ? te(errorMessage.key, errorMessage.values) : null;
  useAnnounce(error);
  const [step, setStep] = useState<EmailChangeStep>('start');
  const [stepUpCode, setStepUpCode] = useState('');
  const [draft, setDraft] = useState('');
  const [tried, setTried] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const fieldRef = useRef<TextInput>(null);
  const focusSoon = () => setTimeout(() => fieldRef.current?.focus(), 50);
  const problemMessage = problemOf(draft, current, tried);
  const problem = problemMessage ? te(problemMessage.key, problemMessage.values) : null;

  /** Applies a use case's answer: the next step (and what it clears), an error, or a refusal. */
  const apply = (o: EmailOutcome): ErrorMessage | null => {
    if (o.kind === 'refused') {
      return refused(o.failure);
    }
    if (o.kind === 'error') {
      return o.error;
    }
    if (o.clear === 'step-up-code') {
      setStepUpCode('');
    } else if (o.clear === 'code') {
      setCode('');
    }
    if (o.sentTo) {
      setSentTo(o.sentTo);
    }
    setStep(o.step);
    if (o.step !== 'done') {
      focusSoon();
    }
    return o.error ?? null;
  };

  const sendStepUp = () =>
    run(async () => (waiting ? null : apply(afterStepUpCode(await actions.requestStepUpCode()))));

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
      if (waiting || problemOf(draft, current, true)) {
        return null;
      }
      return apply(afterEmailChangeRequest(await actions.requestEmailChange(draft, stepUpCode)));
    });

  const confirm = () =>
    run(async () => apply(afterEmailConfirm(await actions.confirmEmailChange(sentTo, code), sentTo)));

  const restart = () => {
    setStep('start');
    setStepUpCode('');
    setCode('');
    setError(null);
  };

  const text = (body: string, testID?: string) => (
    <Text testID={testID} style={[s.text, { color: p.text }]}>
      {body}
    </Text>
  );
  const link = (label: string, testID: string, onPress: () => void, disabled = busy) => (
    <Pressable
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={s.linkTarget}
    >
      <Text style={[s.link, { color: disabled ? p.muted : p.accentText }]}>{label}</Text>
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
        {text(t('email.done', { next: sentTo }), 'account-email-done-text')}
        <Button testID='account-email-done' label={tc('done')} color={ACCENT} onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {step === 'start' && (
        <>
          {text(t('email.intro', { current }))}
          {errorText}
          <Button
            testID='account-email-send-code'
            label={t('code.sendCode')}
            color={ACCENT}
            busy={busy}
            disabled={waiting}
            onPress={() => void sendStepUp()}
          />
        </>
      )}
      {step === 'current-code' && (
        <>
          {text(t('email.currentSent', { current }), 'account-email-current-sent')}
          <AccountField
            ref={fieldRef}
            testID='account-email-current-code'
            label={t('code.label')}
            code
            value={stepUpCode}
            onChangeText={setStepUpCode}
            onSubmitEditing={toNewEmail}
            returnKeyType='next'
          />
          {errorText}
          <Button
            testID='account-email-current-continue'
            label={tc('continue')}
            color={ACCENT}
            disabled={!stepUpCode.trim()}
            onPress={toNewEmail}
          />
          {link(t('code.resend'), 'account-email-resend-current', () => void sendStepUp(), busy || waiting)}
        </>
      )}
      {step === 'new-email' && (
        <>
          <AccountField
            ref={fieldRef}
            testID='account-email-new'
            label={t('email.newLabel')}
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
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
            hint={t('email.newHint')}
          />
          {errorText}
          <Button
            testID='account-email-send-new'
            label={t('email.sendNew')}
            color={ACCENT}
            busy={busy}
            disabled={waiting || !draft.trim() || problem != null}
            onPress={() => void sendToNew()}
          />
        </>
      )}
      {step === 'new-code' && (
        <>
          {text(t('email.newSent', { next: sentTo }), 'account-email-new-sent')}
          <AccountField
            ref={fieldRef}
            testID='account-email-new-code'
            label={t('code.label')}
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
            label={t('email.confirm')}
            color={ACCENT}
            busy={busy}
            disabled={!code.trim()}
            onPress={() => void confirm()}
          />
          {/* A new code for the new inbox needs a fresh code to the current one: start again. */}
          {link(t('email.restart'), 'account-email-restart', restart)}
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
