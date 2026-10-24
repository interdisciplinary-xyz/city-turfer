'use client';

import { useTranslations } from 'next-intl';

import { activitiesHref } from '@/api/next-path';
import { Link } from '@/i18n/navigation';

import { ErrorMessage } from '../error-message';
import { Notice } from '../notice';
import { Unreachable } from '../unreachable';
import type { ActivityStateProps } from './activity-state.constants';

/**
 * One activity's page while it loads, when it isn't there (unknown id, not this user's: "not
 * found"; deleted on the phone) or when the API fails; always with the way back to the list.
 */
export function ActivityState({ view, locale, onRetry, retrying = false }: ActivityStateProps) {
  const t = useTranslations('portal.activities');
  const tp = useTranslations('portal');
  return (
    <div className='portal-page'>
      <p className='portal-back'>
        <Link href={activitiesHref()} locale={locale}>
          <span aria-hidden='true'>← </span>
          {t('detail.back')}
        </Link>
      </p>
      {view.kind === 'loading' ? (
        <p className='portal-hint' role='status'>
          {t('detail.loading')}
        </p>
      ) : null}
      {view.kind === 'not-found' || view.kind === 'deleted' ? (
        <>
          <h1 className='portal-title'>{t('detail.notFoundTitle')}</h1>
          <Notice>
            <p>{view.kind === 'deleted' ? tp('errors.activity.deleted') : t('detail.notFound')}</p>
          </Notice>
        </>
      ) : null}
      {view.kind === 'unreachable' ? <Unreachable onRetry={onRetry} retrying={retrying} /> : null}
      {view.kind === 'error' ? <ErrorMessage error={view.error} /> : null}
    </div>
  );
}
