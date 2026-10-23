'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

import { isPortalError, PortalError } from '@/api/errors';

import { ErrorMessage } from '../error-message';
import { describeWait } from '../format';
import { Notice } from '../notice';
import { useHydrated } from '../use-hydrated';
import {
  CODE_LENGTH,
  INITIAL_RATE_LIMIT_STATE,
  onAttempt,
  onBlockEnded,
  onFailure,
  type RateLimitState,
  sanitizeCode,
  type SignInAction,
  type SignInFormProps,
  type SignInStep,
} from './sign-in-form.constants';
import { useCountdown } from './use-countdown';

function asPortalError(error: unknown): PortalError {
  return isPortalError(error) ? error : new PortalError('generic');
}

/**
 * Sign-in by e-mailed code, in two steps on one page. After the e-mail step the copy is the same
 * whether or not the address has an account (no account enumeration). One numeric field takes
 * the code, typed or pasted; a 429 shows a countdown from `Retry-After` and blocks only what was
 * refused (asking for a code, or signing in), then says it can be tried again. Nothing is stored: the
 * e-mail lives in this component's state only, and the session is the API's HttpOnly cookie.
 */
export function SignInForm({
  mode = 'sign-in',
  switchHref,
  onRequestCode,
  onSignIn,
  reason,
  initialStep = 'email',
  initialEmail = '',
}: SignInFormProps) {
  const t = useTranslations('portal.signIn');
  const tc = useTranslations('portal.common');
  const tr = useTranslations('portal.register');
  const register = mode === 'register';
  const id = useId();
  const [step, setStep] = useState<SignInStep>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [sharedComputer, setSharedComputer] = useState(false);
  const [pending, setPending] = useState(false);
  const [limits, setLimits] = useState<RateLimitState>(INITIAL_RATE_LIMIT_STATE);
  const [incomplete, setIncomplete] = useState(false);
  const [resent, setResent] = useState(false);
  const codeLeft = useCountdown(limits.blocks.code);
  const signInLeft = useCountdown(limits.blocks['sign-in']);
  const left: Record<SignInAction, number> = { code: codeLeft, 'sign-in': signInLeft };
  const codeBlocked = left.code > 0;
  const signInBlocked = left['sign-in'] > 0;
  const error = limits.failure?.error ?? null;
  const hydrated = useHydrated();
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const moved = useRef(false);

  // Move focus with the step (not on first render): to the code field, or back to the e-mail.
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    (step === 'code' ? codeRef : emailRef).current?.focus();
  }, [step]);

  // A block ran out: lift it and swap its "too many tries" alert for "you can try again".
  const codeEnded = limits.blocks.code !== null && left.code === 0;
  const signInEnded = limits.blocks['sign-in'] !== null && left['sign-in'] === 0;
  useEffect(() => {
    if (codeEnded) {
      setLimits((state) => onBlockEnded(state, 'code'));
    }
    if (signInEnded) {
      setLimits((state) => onBlockEnded(state, 'sign-in'));
    }
  }, [codeEnded, signInEnded]);

  function fail(action: SignInAction, raw: unknown) {
    const portalError = asPortalError(raw);
    setLimits((state) => onFailure(state, action, portalError, Date.now()));
  }

  function attempt() {
    setLimits(onAttempt);
  }

  async function sendCode(again: boolean) {
    setPending(true);
    attempt();
    setResent(false);
    try {
      await onRequestCode(email.trim());
      if (again) {
        setResent(true);
      } else {
        setStep('code');
      }
    } catch (raw) {
      fail('code', raw);
    } finally {
      setPending(false);
    }
  }

  function onSubmitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendCode(false);
  }

  async function onSubmitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sanitizeCode(code).length !== CODE_LENGTH) {
      setIncomplete(true);
      codeRef.current?.focus();
      return;
    }
    setIncomplete(false);
    setPending(true);
    attempt();
    setResent(false);
    try {
      await onSignIn({ email: email.trim(), code, sharedComputer });
      // Signed in: the page navigates away; keep the button in its pending state until it does.
    } catch (raw) {
      setPending(false);
      setCode('');
      fail('sign-in', raw);
    }
  }

  function chooseOtherEmail() {
    setStep('email');
    setCode('');
    attempt();
    setResent(false);
    setIncomplete(false);
  }

  // The live wait belongs to the alert on screen: the action that was refused.
  const waitSeconds = limits.failure ? left[limits.failure.action] : 0;
  const wait = waitSeconds > 0 ? describeWait(waitSeconds) : null;

  return (
    <div className='portal-sign-in'>
      {reason ? (
        <Notice role='status'>
          <p>{t(`notice.${reason}`)}</p>
        </Notice>
      ) : null}
      <h1 className='portal-title'>{register ? tr('title') : t('title')}</h1>
      <p className='portal-lede'>{register ? tr('lede') : t('lede')}</p>

      {step === 'email' ? (
        <form className='portal-form' method='post' onSubmit={onSubmitEmail} aria-describedby={`${id}-cookie`}>
          <label className='portal-label' htmlFor={`${id}-email`}>
            {t('emailLabel')}
          </label>
          <input
            ref={emailRef}
            id={`${id}-email`}
            className='portal-input'
            type='email'
            name='email'
            required
            maxLength={254}
            autoComplete='email'
            inputMode='email'
            spellCheck={false}
            autoCapitalize='none'
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            className='portal-button portal-button-primary'
            type='submit'
            disabled={!hydrated || pending || codeBlocked}
          >
            {pending ? t('sendingCode') : t('sendCode')}
          </button>
        </form>
      ) : (
        <form className='portal-form' method='post' onSubmit={onSubmitCode} aria-describedby={`${id}-cookie`}>
          <p className='portal-sent' role='status'>
            {t('codeSent', { email: email.trim() })}
          </p>
          <label className='portal-label' htmlFor={`${id}-code`}>
            {t('codeLabel')}
          </label>
          <input
            ref={codeRef}
            id={`${id}-code`}
            className='portal-input portal-code'
            type='text'
            name='code'
            inputMode='numeric'
            autoComplete='one-time-code'
            enterKeyHint='go'
            aria-describedby={`${id}-code-hint`}
            aria-invalid={incomplete || error?.code === 'auth.invalid-code' ? true : undefined}
            value={code}
            onChange={(event) => {
              setCode(sanitizeCode(event.target.value));
              setIncomplete(false);
            }}
          />
          <p id={`${id}-code-hint`} className='portal-hint'>
            {incomplete ? t('codeIncomplete') : t('codeHint')}
          </p>
          <label className='portal-check'>
            <input
              type='checkbox'
              name='sharedComputer'
              checked={sharedComputer}
              onChange={(event) => setSharedComputer(event.target.checked)}
              aria-describedby={`${id}-shared-hint`}
            />
            <span>{t('sharedComputer')}</span>
          </label>
          <p id={`${id}-shared-hint`} className='portal-hint portal-check-hint'>
            {t('sharedComputerHint')}
          </p>
          <button
            className='portal-button portal-button-primary'
            type='submit'
            disabled={!hydrated || pending || signInBlocked}
          >
            {pending ? (register ? tr('creating') : t('signingIn')) : register ? tr('submit') : t('submit')}
          </button>
          <div className='portal-row'>
            <button
              className='portal-button portal-button-quiet'
              type='button'
              onClick={() => void sendCode(true)}
              disabled={!hydrated || pending || codeBlocked}
            >
              {t('resend')}
            </button>
            <button
              className='portal-button portal-button-quiet'
              type='button'
              onClick={chooseOtherEmail}
              disabled={pending}
            >
              {t('otherEmail')}
            </button>
          </div>
          {resent ? (
            <p className='portal-hint' role='status'>
              {t('resent')}
            </p>
          ) : null}
        </form>
      )}

      {error ? <ErrorMessage error={error} hideWait={error.retryAfterSeconds !== null} /> : null}
      {/* Counts down visually; the alert above already said "too many tries", so this isn't live. */}
      {wait ? <p className='portal-wait'>{tc(wait.key, { count: wait.count })}</p> : null}
      {limits.canRetry ? (
        <p className='portal-hint' role='status'>
          {t('canRetry')}
        </p>
      ) : null}
      {switchHref && step === 'email' ? (
        <p className='portal-switch'>
          {register ? tr('haveAccount') : tr('newHere')}{' '}
          <a href={switchHref}>{register ? tr('toSignIn') : tr('toRegister')}</a>
        </p>
      ) : null}
      <p id={`${id}-cookie`} className='portal-fineprint'>
        {t('cookie')}
      </p>
    </div>
  );
}
