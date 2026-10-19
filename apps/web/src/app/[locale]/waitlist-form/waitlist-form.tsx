'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';

import { BREVO_FIELDS, type WaitlistFormProps, type WaitlistState } from './waitlist-form.constants';

/**
 * Waitlist sign-up, posted straight to Brevo (no backend of ours). The request is `no-cors`:
 * Brevo receives it whatever its CORS settings, and the response is opaque, so the form reports
 * "check your inbox": Brevo's double opt-in email is the real confirmation.
 */
export function WaitlistForm({ action, controller, contactEmail, locale }: WaitlistFormProps) {
  const t = useTranslations('waitlist');
  const id = useId();
  const [state, setState] = useState<WaitlistState>('idle');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get(BREVO_FIELDS.honeypot)) {
      return; // a bot filled the hidden field
    }
    setState('sending');
    try {
      await fetch(action, { method: 'POST', body: data, mode: 'no-cors' });
      setState('sent');
      form.reset();
    } catch {
      setState('failed');
    }
  }

  if (state === 'sent') {
    return (
      <div className='waitlist' role='status'>
        <p className='waitlist-done'>{t('sent')}</p>
      </div>
    );
  }

  return (
    <form className='waitlist' onSubmit={onSubmit} aria-describedby={`${id}-privacy`}>
      <p className='waitlist-title'>{t('title')}</p>
      <div className='waitlist-row'>
        <label className='visually-hidden' htmlFor={`${id}-email`}>
          {t('emailLabel')}
        </label>
        <input
          id={`${id}-email`}
          className='waitlist-email'
          type='email'
          name={BREVO_FIELDS.email}
          required
          autoComplete='email'
          inputMode='email'
          placeholder={t('emailPlaceholder')}
        />
        <button className='waitlist-submit' type='submit' disabled={state === 'sending'}>
          {state === 'sending' ? t('sending') : t('submit')}
        </button>
      </div>
      <label className='waitlist-consent'>
        <input type='checkbox' name={BREVO_FIELDS.consent} value='1' required />
        <span>{t('consent')}</span>
      </label>
      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <input
        className='visually-hidden'
        type='text'
        name={BREVO_FIELDS.honeypot}
        tabIndex={-1}
        autoComplete='off'
        aria-hidden='true'
      />
      <input type='hidden' name={BREVO_FIELDS.locale} value={locale} />
      {state === 'failed' ? (
        <p className='waitlist-error' role='alert'>
          {t('failed')}
        </p>
      ) : null}
      <p id={`${id}-privacy`} className='waitlist-privacy'>
        {t('privacy', { controller, contactEmail })}
      </p>
    </form>
  );
}
