'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { formatDate } from '../format';
import { Notice } from '../notice';
import { backupState, type BackupStatusProps } from './backup-status.constants';

/**
 * The backup consents, read-only (decision D5: they are changed in the app, because withdrawing
 * erases the server copy). Each state is an empty state of the plan: never on, withdrawn, on.
 */
export function BackupStatus({ consents, locale }: BackupStatusProps) {
  const t = useTranslations('portal.privacy.backup');
  const id = useId();
  const state = backupState(consents);
  return (
    <section className='portal-card' aria-labelledby={id}>
      <h2 id={id} className='portal-card-title'>
        {t('title')}
      </h2>
      {state.kind === 'never' ? (
        <Notice>
          <p>{t('never')}</p>
        </Notice>
      ) : null}
      {state.kind === 'withdrawn' ? (
        <Notice>
          <p>{t('withdrawn', { date: formatDate(locale, state.at) })}</p>
        </Notice>
      ) : null}
      {state.kind === 'on' ? (
        <>
          <p>{t('on', { date: formatDate(locale, state.since) })}</p>
          <p>
            {state.health.included ? t('healthOn', { date: formatDate(locale, state.health.since) }) : t('healthOff')}
          </p>
          <p className='portal-muted'>{t('policy', { version: state.policyVersion })}</p>
        </>
      ) : null}
      <p className='portal-muted'>{t('changeInApp')}</p>
    </section>
  );
}
