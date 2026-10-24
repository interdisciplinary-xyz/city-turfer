import { FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { AccountField } from './account-field';
import type { ErrorMessage } from './account-settings.constants';
import type { BackupLinkFlowProps, BackupLinkOutcome, BackupLinkStep } from './backup-link-flow.constants';
import { afterBackupLink, afterBackupLinkCode } from './backup-link-steps';
import { useBackupLink, useBackupLinkTarget, useSecondsLeft, useSubmit } from './hooks';
import { useAnnounce } from './use-announce';

/**
 * Backing up a local profile (mock admin, demo; decision LP1): a code goes to the profile's own
 * address as soon as this opens (the Turfer just tapped "Email me a code"), the code links that
 * address's account to the profile, then the screen decides about backup (`onLinked`): on, or
 * left off when the Turfer had turned it off. The address is fixed.
 */
export function BackupLinkFlow({ onLinked, onDone, turnsOn }: BackupLinkFlowProps) {
  const p = usePalette();
  const t = useT('backup');
  const te = useT('errors');
  const tc = useT('common');
  const target = useBackupLinkTarget();
  const actions = useBackupLink();
  const { busy, error: errorMessage, setError, run, refused, waiting, waitUntil } = useSubmit();
  const secondsLeft = useSecondsLeft(waitUntil);
  const [step, setStep] = useState<BackupLinkStep>('request');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  /** On the code step after a rate limit: a code went out recently, not just now. */
  const [sentRecently, setSentRecently] = useState(false);
  /** Turning backup on failed after the link: its message (the code is used up, so only that is retried). */
  const [turnOnError, setTurnOnError] = useState<string | null>(null);
  /** Linked, and backup stays off (the Turfer had turned it off): say so, then Done. */
  const [stayedOff, setStayedOff] = useState<string | null>(null);
  const fieldRef = useRef<TextInput>(null);
  const requested = useRef(false);
  const email = sentTo || target?.email || '';
  const error = turnOnError ?? (errorMessage ? te(errorMessage.key, errorMessage.values) : null);
  useAnnounce(error);

  const apply = (o: BackupLinkOutcome): ErrorMessage | null => {
    if (o.kind === 'refused') {
      return refused(o.failure);
    }
    if (o.kind === 'error') {
      return o.error;
    }
    if (o.clear === 'code') {
      setCode('');
    }
    if (o.sentTo) {
      setSentTo(o.sentTo);
    }
    if (o.wait) {
      refused(o.wait); // only its wait (the resend countdown): a code went out recently
    }
    setSentRecently(o.wait !== undefined);
    setStep(o.step);
    if (o.step === 'code') {
      setTimeout(() => fieldRef.current?.focus(), 50);
    }
    return o.error ?? null;
  };

  const linked = async () => {
    setTurnOnError(null);
    const r = await onLinked();
    setStayedOff(r.kind === 'stayed-off' ? r.message : null);
    setTurnOnError(r.kind === 'failed' ? r.message : null);
  };

  const turnOn = () => run(linked);

  const send = () => run(async () => (waiting ? null : apply(afterBackupLinkCode(await actions.requestCode()))));

  const submit = () =>
    run(async () => {
      const r = await actions.link(code);
      const next = apply(afterBackupLink(r, email));
      if (r.kind === 'linked') {
        await linked();
      }
      return next;
    });

  useEffect(() => {
    if (!requested.current) {
      requested.current = true; // once per visit: the card's button asked for this code
      void send();
    }
  });

  const resendLabel = secondsLeft > 0 ? t('link.resendIn', { count: secondsLeft }) : t('link.resend');
  const resend = (
    <Pressable
      testID='backup-link-resend'
      accessibilityRole='button'
      accessibilityLabel={resendLabel}
      accessibilityState={{ disabled: busy || waiting }}
      onPress={() => void send()}
      disabled={busy || waiting}
      style={s.linkTarget}
    >
      <Text style={[s.link, { color: busy || waiting ? p.muted : p.accentText }]}>{resendLabel}</Text>
    </Pressable>
  );
  const errorText = error && (
    <Text testID='backup-link-error' accessibilityLiveRegion='polite' style={[s.error, { color: p.danger }]}>
      {error}
    </Text>
  );

  return (
    <View style={s.root}>
      {step === 'request' && (
        <>
          <Text testID='backup-link-intro' style={[s.text, { color: p.text }]}>
            {busy ? t('link.sending') : t('link.intro', { email })}
          </Text>
          {busy && <ActivityIndicator color={ACCENT} accessibilityLabel={t('link.sending')} />}
          {errorText}
          {!busy && (
            <Button
              testID='backup-link-send'
              label={secondsLeft > 0 ? resendLabel : t('link.request')}
              color={ACCENT}
              disabled={waiting}
              onPress={() => void send()}
            />
          )}
        </>
      )}
      {step === 'code' && (
        <>
          <Text testID='backup-link-sent' style={[s.text, { color: p.text }]}>
            {sentRecently ? t('link.sentRecently', { email }) : t('link.sent', { email })}
          </Text>
          <AccountField
            ref={fieldRef}
            testID='backup-link-code'
            label={t('link.codeLabel')}
            code
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setError(null);
            }}
            onSubmitEditing={() => void submit()}
            returnKeyType='go'
            editable={!busy}
          />
          {errorText}
          {/* "Turn on backup" records consent: say where the data goes right next to it. */}
          {turnsOn && (
            <Text testID='backup-link-privacy' style={[s.note, { color: p.muted }]}>
              {t('privacy')}
            </Text>
          )}
          <Button
            testID='backup-link-submit'
            label={turnsOn ? t('link.submit') : t('link.confirm')}
            color={ACCENT}
            busy={busy}
            disabled={!code.trim()}
            onPress={() => void submit()}
          />
          {resend}
        </>
      )}
      {step === 'turning-on' && (
        <>
          <Text testID='backup-link-linked' style={[s.text, { color: p.text }]}>
            {busy && turnsOn ? t('link.turningOn') : t('link.linked', { email })}
          </Text>
          {stayedOff !== null && (
            <Text testID='backup-link-stayed-off' style={[s.text, { color: p.text }]}>
              {stayedOff}
            </Text>
          )}
          {errorText}
          {stayedOff !== null && (
            <Button testID='backup-link-done' label={tc('done')} color={ACCENT} onPress={onDone} />
          )}
          {!busy && turnOnError && (
            <Button
              testID='backup-link-turn-on'
              label={t('link.submit')}
              color={ACCENT}
              onPress={() => void turnOn()}
            />
          )}
          {busy && turnsOn && <ActivityIndicator color={ACCENT} accessibilityLabel={t('link.turningOn')} />}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: SPACE.lg },
  text: { fontSize: FONT_SIZE.body },
  error: { fontSize: FONT_SIZE.caption },
  note: { fontSize: FONT_SIZE.caption },
  link: { fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
});
