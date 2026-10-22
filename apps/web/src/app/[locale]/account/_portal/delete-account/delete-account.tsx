'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

import { ErrorMessage } from '../error-message';
import { confirmationMatches, type DeleteAccountProps } from './delete-account.constants';

/**
 * Delete account (GDPR erasure, `DELETE /v1/me`), in two steps: open the confirmation, then type
 * the confirmation word. It erases the server copy only; the promise "Everything is still on your
 * phone" is on screen before the button.
 */
export function DeleteAccount({ onDelete, pending, error, initialOpen = false }: DeleteAccountProps) {
  const t = useTranslations('portal.privacy.delete');
  const tc = useTranslations('portal.common');
  const id = useId();
  const [open, setOpen] = useState(initialOpen);
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(initialOpen);
  const word = t('confirmWord');
  const matches = confirmationMatches(typed, word);

  useEffect(() => {
    if (open && !opened.current) {
      inputRef.current?.focus();
    }
    opened.current = open;
  }, [open]);

  function cancel() {
    setOpen(false);
    setTyped('');
    // Back to the button that opened it, so keyboard users don't lose their place.
    window.requestAnimationFrame(() => startRef.current?.focus());
  }

  return (
    <section className='portal-card portal-card-danger' aria-labelledby={id}>
      <h2 id={id} className='portal-card-title'>
        {t('title')}
      </h2>
      <p>{t('lede')}</p>
      <p className='portal-promise'>{t('phone')}</p>
      {open ? (
        <form
          className='portal-form'
          method='post'
          onSubmit={(event) => {
            event.preventDefault();
            if (matches && !pending) {
              onDelete();
            }
          }}
        >
          <label className='portal-label' htmlFor={`${id}-confirm`}>
            {t('confirmLabel', { word })}
          </label>
          <input
            ref={inputRef}
            id={`${id}-confirm`}
            className='portal-input'
            type='text'
            autoComplete='off'
            autoCapitalize='characters'
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <div className='portal-row'>
            <button className='portal-button portal-button-danger' type='submit' disabled={!matches || pending}>
              {pending ? t('deleting') : t('confirm')}
            </button>
            <button className='portal-button portal-button-quiet' type='button' onClick={cancel} disabled={pending}>
              {tc('cancel')}
            </button>
          </div>
          {error ? <ErrorMessage error={error} /> : null}
        </form>
      ) : (
        <button
          ref={startRef}
          className='portal-button portal-button-danger-outline'
          type='button'
          onClick={() => setOpen(true)}
        >
          {t('start')}
        </button>
      )}
    </section>
  );
}
