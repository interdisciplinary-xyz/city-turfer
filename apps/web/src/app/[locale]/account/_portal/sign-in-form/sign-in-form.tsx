'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

import { isPortalError, PortalError } from '@/api/errors';

import { ErrorMessage } from '../error-message';
import { describeWait } from '../format';
import { Notice } from '../notice';
import { useHydrated } from '../use-hydrated';
import { CODE_LENGTH, sanitizeCode, type SignInFormProps, type SignInStep } from './sign-in-form.constants';
import { useCountdown } from './use-countdown';

function asPortalError(error: unknown): PortalError {
  return isPortalError(error) ? error : new PortalError('generic');
}

/**
 * Sign-in by e-mailed code, in two steps on one page. After the e-mail step the copy is the same
 * whether or not the address has an account (no account enumeration). One numeric field takes
 * the code, typed or pasted; a 429 shows a countdown from `Retry-After`. Nothing is stored: the
 * e-mail lives in this component's state only, and the session is the API's HttpOnly cookie.
 */
export function SignInForm({
  onRequestCode,
  onSignIn,
  reason,
  initialStep = 'email',
  initialEmail = '',
}: SignInFormProps) {
  const t = useTranslations('portal.signIn');
  const tc = useTranslations('portal.common');
  const id = useId();
  const [step, setStep] = useState<SignInStep>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [sharedComputer, setSharedComputer] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PortalError | null>(null);
  const [incomplete, setIncomplete] = useState(false);
  const [resent, setResent] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const secondsLeft = useCountdown(blockedUntil);
  const blocked = secondsLeft > 0;
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

  function fail(raw: unknown) {
    const portalError = asPortalError(raw);
    setError(portalError);
    if (portalError.retryAfterSeconds !== null) {
      setBlockedUntil(Date.now() + portalError.retryAfterSeconds * 1000);
    }
  }

  async function sendCode(again: boolean) {
    setPending(true);
    setError(null);
    setResent(false);
    try {
      await onRequestCode(email.trim());
      if (again) {
        setResent(true);
      } else {
        setStep('code');
      }
    } catch (raw) {
      fail(raw);
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
    setError(null);
    setResent(false);
    try {
      await onSignIn({ email: email.trim(), code, sharedComputer });
      // Signed in: the page navigates away; keep the button in its pending state until it does.
    } catch (raw) {
      setPending(false);
      setCode('');
      fail(raw);
    }
  }

  function chooseOtherEmail() {
    setStep('email');
    setCode('');
    setError(null);
    setResent(false);
    setIncomplete(false);
  }

  const wait = blocked ? describeWait(secondsLeft) : null;

  return (
    <div className='portal-sign-in'>
      {reason ? (
        <Notice role='status'>
          <p>{t(`notice.${reason}`)}</p>
        </Notice>
      ) : null}
      <h1 className='portal-title'>{t('title')}</h1>
      <p className='portal-lede'>{t('lede')}</p>

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
            disabled={!hydrated || pending || blocked}
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
            disabled={!hydrated || pending || blocked}
          >
            {pending ? t('signingIn') : t('submit')}
          </button>
          <div className='portal-row'>
            <button
              className='portal-button portal-button-quiet'
              type='button'
              onClick={() => void sendCode(true)}
              disabled={!hydrated || pending || blocked}
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
      <p id={`${id}-cookie`} className='portal-fineprint'>
        {t('cookie')}
      </p>
    </div>
  );
}
