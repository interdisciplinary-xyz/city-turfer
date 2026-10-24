'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import { isActivityId } from '@/api/activity-id';
import { forgetActivity, useActivity, usePortal, useTrack } from '@/api/hooks';
import { activitiesHref } from '@/api/next-path';
import { Link } from '@/i18n/navigation';

import { ActivityDetailView } from '../activity-detail';
import { browserZone } from '../activity-time';
import { ErrorMessage } from '../error-message';
import { Notice } from '../notice';
import { Unreachable } from '../unreachable';
import { type ActivityPageProps, activityView } from './activity-page.constants';

/**
 * `/[locale]/account/activity?id=…` (H2): one activity from the backed-up copy. The id is the
 * phone's opaque id; it is only sent to the API when it has the contract's shape.
 */
export function ActivityPage({ locale }: ActivityPageProps) {
  const t = useTranslations('portal.activities');
  const tp = useTranslations('portal');
  const router = useRouter();
  const { queryClient } = usePortal();
  const rawId = useSearchParams().get('id');
  const id = isActivityId(rawId) ? rawId : null;
  const detail = useActivity(id);
  const track = useTrack(id, detail.isSuccess ? detail.data.trackHash : null);
  const zone = useMemo(() => browserZone(), []);
  const view = activityView({ rawId, validId: id !== null, hasData: detail.data !== undefined, error: detail.error });

  const gone = id !== null && (view.kind === 'not-found' || view.kind === 'deleted');
  useEffect(() => {
    if (gone) {
      forgetActivity(queryClient, id);
    }
  }, [gone, id, queryClient]);

  useEffect(() => {
    if (view.kind === 'to-list') {
      router.replace(`/${locale}${activitiesHref()}`);
    }
  }, [view.kind, router, locale]);

  const back = (
    <p className='portal-back'>
      <Link href={activitiesHref()} locale={locale}>
        <span aria-hidden='true'>← </span>
        {t('detail.back')}
      </Link>
    </p>
  );

  switch (view.kind) {
    case 'activity':
      return detail.data ? (
        <ActivityDetailView
          activity={detail.data}
          track={track.data ?? null}
          trackFailed={track.isError && track.error.code !== 'signed-out'}
          locale={locale}
          browserZone={zone}
        />
      ) : null;
    case 'to-list':
      return (
        <p className='portal-hint' role='status'>
          {t('detail.redirecting')}
        </p>
      );
    case 'leaving':
      return null;
    case 'loading':
      return (
        <div className='portal-page'>
          {back}
          <p className='portal-hint' role='status'>
            {t('detail.loading')}
          </p>
        </div>
      );
    case 'not-found':
      return (
        <div className='portal-page'>
          {back}
          <h1 className='portal-title'>{t('detail.notFoundTitle')}</h1>
          <Notice>
            <p>{t('detail.notFound')}</p>
          </Notice>
        </div>
      );
    case 'deleted':
      return (
        <div className='portal-page'>
          {back}
          <h1 className='portal-title'>{t('detail.notFoundTitle')}</h1>
          <Notice>
            <p>{tp('errors.activity.deleted')}</p>
          </Notice>
        </div>
      );
    case 'unreachable':
      return (
        <div className='portal-page'>
          {back}
          <Unreachable onRetry={() => void detail.refetch()} retrying={detail.isFetching} />
        </div>
      );
    case 'error':
      return (
        <div className='portal-page'>
          {back}
          <ErrorMessage error={view.error} />
        </div>
      );
  }
}
