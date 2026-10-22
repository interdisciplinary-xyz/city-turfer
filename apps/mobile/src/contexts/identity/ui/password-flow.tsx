import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { accountFieldError, newPassword } from '@/contexts/identity';
import { useApp } from '@/ui-kit/app-context';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { AccountField } from './account-field';
import {
  CODE_COPY,
  failureText,
  FIELD_ERROR_TEXT,
  INVALID_CODE,
  PASSWORD_COPY,
  type PasswordFlowProps,
} from './account-settings.constants';
import { useAccountActions, useSubmit } from './hooks';
import type { PasswordStep } from './password-flow.constants';

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
 * current address (step-up); the code and the new password go to the server together.
 */
export function PasswordFlow({ action, onDone }: PasswordFlowProps) {
  const p = usePalette();
  const { auth } = useApp();
  const email = auth.status === 'signed-in' ? auth.user.email : '';
  const actions = useAccountActions();
  const { busy, error, run } = useSubmit();
  const [step, setStep] = useState<PasswordStep>('start');
  const [code, setCode] = useState('');
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState(false);
  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const removing = action === 'remove';
  const rule = removing ? null : ruleOf(draft);
  // Too short is what the hint already says; only a too-long password is an error while typing.
  const liveError = rule === 'password.too-long' ? FIELD_ERROR_TEXT[rule] : null;

  const sendCode = () =>
    run(async () => {
      const r = await actions.requestStepUpCode();
      if (r.kind !== 'sent') {
        return failureText(r);
      }
      setCode('');
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
    });

  const save = () =>
    run(async () => {
      const r = removing ? await actions.removePassword(code) : await actions.setPassword(draft, code);
      switch (r.kind) {
        case 'saved':
        case 'removed':
          setStep('done');
          return null;
        case 'invalid-code':
          return INVALID_CODE;
        case 'breached':
          return PASSWORD_COPY.breached;
        case 'field-error':
          return FIELD_ERROR_TEXT[r.code];
        default:
          return failureText(r);
      }
    });

  const text = (t: string, testID?: string) => (
    <Text testID={testID} style={[s.text, { color: p.text }]}>
      {t}
    </Text>
  );

  if (step === 'done') {
    return (
      <View style={s.root}>
        {text(PASSWORD_COPY.done[action], 'account-password-done-text')}
        <Button testID='account-password-done' label={PASSWORD_COPY.doneButton} color={ACCENT} onPress={onDone} />
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
      {text(PASSWORD_COPY.intro[action])}
      {step === 'start' && (
        <>
          {text(PASSWORD_COPY.stepUp(email))}
          {errorText}
          <Button
            testID='account-password-send-code'
            label={CODE_COPY.sendCode}
            color={ACCENT}
            busy={busy}
            onPress={() => void sendCode()}
          />
        </>
      )}
      {step === 'code' && (
        <>
          {text(PASSWORD_COPY.sent(email), 'account-password-code-sent')}
          <AccountField
            ref={codeRef}
            testID='account-password-code'
            label={CODE_COPY.label}
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
                label={PASSWORD_COPY.newLabel}
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
                hint={PASSWORD_COPY.newHint}
              />
              <Pressable
                testID='account-password-show'
                accessibilityRole='switch'
                accessibilityLabel={PASSWORD_COPY.show}
                accessibilityState={{ checked: shown }}
                onPress={() => setShown((v) => !v)}
                style={s.linkTarget}
              >
                <Text style={[s.toggle, { color: p.accentText }]}>
                  {shown ? PASSWORD_COPY.hide : PASSWORD_COPY.show}
                </Text>
              </Pressable>
            </>
          )}
          {errorText}
          <Button
            testID={removing ? 'account-password-remove' : 'account-password-save'}
            label={PASSWORD_COPY.save[action]}
            color={removing ? p.border : ACCENT}
            textColor={removing ? p.danger : undefined}
            busy={busy}
            disabled={!code.trim() || rule != null}
            onPress={() => void save()}
          />
          <Pressable
            testID='account-password-resend'
            accessibilityRole='button'
            accessibilityLabel={CODE_COPY.resend}
            onPress={() => void sendCode()}
            disabled={busy}
            style={s.linkTarget}
          >
            <Text style={[s.link, { color: p.accentText }]}>{CODE_COPY.resend}</Text>
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
