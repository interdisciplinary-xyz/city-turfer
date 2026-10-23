import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { accountFieldError, newPassword, PASSWORD_MIN } from '@/contexts/identity';
import { useT } from '@/i18n';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { AccountField } from './account-field';
import { type ErrorMessage, FIELD_ERROR, type PasswordFlowProps } from './account-settings.constants';
import { useAccountActions, useSubmit } from './hooks';
import type { PasswordOutcome, PasswordStep } from './password-flow.constants';
import { afterPasswordSave, afterPasswordStepUp, savePassword } from './password-steps';
import { useAnnounce } from './use-announce';

/** The shared rule for a draft password: null when it can be saved. */
function ruleOf(draft: string) {
  try {
    newPassword(draft);
    return null;
  } catch (e) {
    return accountFieldError(e);
  }
}

/**
 * Set, change or remove the optional account password. Each starts with a fresh code to the
 * current address (step-up); the code and the new password go to the server together. `action`
 * comes from the server's `hasPassword` (the screen decides it), never from the route alone.
 */
export function PasswordFlow({ action, onDone }: PasswordFlowProps) {
  const p = usePalette();
  const t = useT('account');
  const tc = useT('common');
  const te = useT('errors');
  const { auth } = useApp();
  const email = auth.status === 'signed-in' ? auth.user.email : '';
  const actions = useAccountActions();
  const { busy, error: errorMessage, run, refused, waiting } = useSubmit();
  const error = errorMessage ? te(errorMessage.key, errorMessage.values) : null;
  useAnnounce(error);
  const [step, setStep] = useState<PasswordStep>('start');
  const [code, setCode] = useState('');
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState(false);
  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const removing = action === 'remove';
  const rule = removing ? null : ruleOf(draft);
  // Too short is what the hint already says; only a too-long password is an error while typing.
  const tooLong = rule === 'password.too-long' ? FIELD_ERROR[rule] : null;
  const liveError = tooLong ? te(tooLong.key, tooLong.values) : null;

  /** Applies a use case's answer: the next step, an error, or a refusal. */
  const apply = (o: PasswordOutcome): ErrorMessage | null => {
    if (o.kind === 'refused') {
      return refused(o.failure);
    }
    if (o.kind === 'error') {
      return o.error;
    }
    if (o.clear === 'code') {
      setCode('');
    }
    setStep(o.step);
    if (o.step === 'code') {
      setTimeout(() => codeRef.current?.focus(), 50);
    }
    return o.error ?? null;
  };

  const sendCode = () =>
    run(async () => (waiting ? null : apply(afterPasswordStepUp(await actions.requestStepUpCode()))));

  const save = () => run(async () => apply(afterPasswordSave(await savePassword(actions, action, draft, code))));

  const text = (body: string, testID?: string) => (
    <Text testID={testID} style={[s.text, { color: p.text }]}>
      {body}
    </Text>
  );

  if (step === 'done') {
    return (
      <View style={s.root}>
        {text(t(`passwordDone.${action}`), 'account-password-done-text')}
        <Button testID='account-password-done' label={tc('done')} color={ACCENT} onPress={onDone} />
      </View>
    );
  }

  const errorText = error && (
    <Text testID='account-password-error' accessibilityLiveRegion='polite' style={[s.error, { color: p.danger }]}>
      {error}
    </Text>
  );

  return (
    <View style={s.root}>
      {text(t(`passwordIntro.${action}`))}
      {step === 'start' && (
        <>
          {text(t('password.stepUp', { email }))}
          {errorText}
          <Button
            testID='account-password-send-code'
            label={t('code.sendCode')}
            color={ACCENT}
            busy={busy}
            disabled={waiting}
            onPress={() => void sendCode()}
          />
        </>
      )}
      {step === 'code' && (
        <>
          {text(t('password.sent', { email }), 'account-password-code-sent')}
          <AccountField
            ref={codeRef}
            testID='account-password-code'
            label={t('code.label')}
            code
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => (removing ? void save() : passwordRef.current?.focus())}
            returnKeyType={removing ? 'go' : 'next'}
            editable={!busy}
          />
          {!removing && (
            <>
              <AccountField
                ref={passwordRef}
                testID='account-password-new'
                label={t('password.newLabel')}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => void (rule ? undefined : save())}
                secureTextEntry={!shown}
                autoCapitalize='none'
                autoCorrect={false}
                spellCheck={false}
                autoComplete='new-password'
                textContentType='newPassword'
                returnKeyType='go'
                editable={!busy}
                error={liveError}
                hint={t('password.newHint', { min: PASSWORD_MIN })}
              />
              <Pressable
                testID='account-password-show'
                accessibilityRole='switch'
                accessibilityLabel={t('password.show')}
                accessibilityState={{ checked: shown }}
                onPress={() => setShown((v) => !v)}
                style={s.linkTarget}
              >
                <Text style={[s.toggle, { color: p.accentText }]}>
                  {shown ? t('password.hide') : t('password.show')}
                </Text>
              </Pressable>
            </>
          )}
          {errorText}
          <Button
            testID={removing ? 'account-password-remove' : 'account-password-save'}
            label={t(`passwordSave.${action}`)}
            color={removing ? p.border : ACCENT}
            textColor={removing ? p.danger : undefined}
            busy={busy}
            disabled={!code.trim() || rule != null}
            onPress={() => void save()}
          />
          <Pressable
            testID='account-password-resend'
            accessibilityRole='button'
            accessibilityLabel={t('code.resend')}
            accessibilityState={{ disabled: busy || waiting }}
            onPress={() => void sendCode()}
            disabled={busy || waiting}
            style={s.linkTarget}
          >
            <Text style={[s.link, { color: busy || waiting ? p.muted : p.accentText }]}>{t('code.resend')}</Text>
          </Pressable>
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
  toggle: { fontWeight: FONT_WEIGHT.semibold },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
});
