'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { formatDate } from '../format';
import type { AccountSummaryProps } from './account-summary.constants';

/** The signed-in account: its e-mail and since when the server knows it. */
export function AccountSummary({ user, locale }: AccountSummaryProps) {
  const t = useTranslations('portal.privacy.account');
  const id = useId();
  return (
    <section className='portal-card' aria-labelledby={id}>
      <h2 id={id} className='portal-card-title'>
        {t('title')}
      </h2>
      <dl className='portal-facts'>
        <dt>{t('email')}</dt>
        <dd className='portal-email'>{user.email ?? t('noEmail')}</dd>
      </dl>
      <p className='portal-muted'>{t('since', { date: formatDate(locale, user.createdAt) })}</p>
    </section>
  );
}
