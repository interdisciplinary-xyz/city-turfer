'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { ErrorMessage } from '../error-message';
import { formatDateTime } from '../format';
import { Notice } from '../notice';
import type { ExportPanelProps } from './export-panel.constants';

/**
 * "Get a copy" (GDPR access and portability): asks the API to e-mail a download link. The link is
 * only in the e-mail, never on this page; the page only follows the job's status.
 */
export function ExportPanel({ email, locale, job, onRequest, pending, error }: ExportPanelProps) {
  const t = useTranslations('portal.privacy.export');
  const id = useId();
  const to = email ?? '';
  const canAskAgain = job === null || job.status === 'failed';
  return (
    <section className='portal-card' aria-labelledby={id}>
      <h2 id={id} className='portal-card-title'>
        {t('title')}
      </h2>
      <p>{t('lede')}</p>
      {job ? (
        <Notice role='status' tone={job.status === 'failed' ? 'warning' : 'info'}>
          {job.status === 'pending' ? <p>{t('pending', { email: to })}</p> : null}
          {(job.status === 'ready' || job.status === 'downloaded') && job.expiresAt ? (
            <p>{t('ready', { email: to, date: formatDateTime(locale, job.expiresAt) })}</p>
          ) : null}
          {job.status === 'failed' ? <p>{t('failed')}</p> : null}
          {job.status === 'expired' ? <p>{t('expired')}</p> : null}
        </Notice>
      ) : null}
      {error ? (
        <ErrorMessage error={error} overrideKey={error.status === 429 ? 'errors.export.rate-limited' : undefined} />
      ) : null}
      {canAskAgain && email !== null ? (
        <button className='portal-button portal-button-secondary' type='button' onClick={onRequest} disabled={pending}>
          {pending ? t('requesting') : t('request')}
        </button>
      ) : null}
    </section>
  );
}
