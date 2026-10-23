'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useActivities, useActivityTotals, useConsents } from '@/api/hooks';

import { ActivitiesEmpty } from '../activities-empty';
import { type ConsentsAnswer, healthLeftOut, historyEmpty } from '../activities-empty/activities-empty.constants';
import { ActivityFilter } from '../activity-filter';
import type { HistoryFilter } from '../activity-filter/activity-filter.constants';
import { ActivityList } from '../activity-list';
import { browserZone } from '../activity-time';
import { ActivityTotals } from '../activity-totals';
import { backupState } from '../backup-status/backup-status.constants';
import { ErrorMessage } from '../error-message';
import { Unreachable } from '../unreachable';
import type { ActivitiesPageProps } from './activities-page.constants';

/**
 * Activities: the backed-up walks, runs and rides (read-only, H3). Totals, a type filter (page
 * state, H6), the list by month with "Show more" (cursor pages of 50), and every empty state.
 * Rendered inside the session gate.
 */
export function ActivitiesPage({ locale }: ActivitiesPageProps) {
  const t = useTranslations('portal.activities');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const type = filter === 'all' ? null : filter;
  const list = useActivities(type);
  const totals = useActivityTotals();
  const consents = useConsents();
  const zone = useMemo(() => browserZone(), []);

  const backup = consents.isSuccess ? backupState(consents.data.items) : null;
  const consentsAnswer: ConsentsAnswer = backup
    ? { status: 'success', backup }
    : consents.isError
      ? { status: 'error' }
      : { status: 'pending' };
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const allCount = totals.data?.allTime.count ?? 0;
  // A 401 is on its way to sign-in: say nothing else. A failed background refresh keeps the list.
  const listError = list.isError && !list.data && list.error.code !== 'signed-out' ? list.error : null;
  const moreError = list.isFetchNextPageError && list.error.code !== 'signed-out' ? list.error : null;
  const empty = list.isSuccess ? historyEmpty({ consents: consentsAnswer, type, listed: items.length }) : null;
  // The consents failed and the list is empty: say why we can't tell more (a 401 is leaving).
  const consentsError =
    empty === 'unknown' && consents.isError && consents.error.code !== 'signed-out' ? consents.error : null;
  const somethingBackedUp = allCount > 0 || items.length > 0 || type !== null;

  return (
    <div className='portal-page'>
      <h1 className='portal-title'>{t('title')}</h1>
      <p className='portal-lede'>{t('lede')}</p>
      {healthLeftOut(backup) ? <p className='portal-hint'>{t('healthOff')}</p> : null}

      {totals.data && allCount > 0 ? <ActivityTotals totals={totals.data} locale={locale} /> : null}
      {somethingBackedUp ? <ActivityFilter value={filter} onChange={setFilter} /> : null}

      {listError?.unreachable ? <Unreachable onRetry={() => void list.refetch()} retrying={list.isFetching} /> : null}
      {listError && !listError.unreachable ? <ErrorMessage error={listError} /> : null}
      {(list.isPending && !listError) || empty === 'waiting' ? (
        <p className='portal-hint' role='status'>
          {t('loading')}
        </p>
      ) : null}
      {empty && empty !== 'waiting' ? <ActivitiesEmpty kind={empty} type={type} /> : null}
      {consentsError?.unreachable ? (
        <Unreachable onRetry={() => void consents.refetch()} retrying={consents.isFetching} />
      ) : null}
      {consentsError && !consentsError.unreachable ? <ErrorMessage error={consentsError} /> : null}

      {items.length > 0 ? <ActivityList items={items} locale={locale} fallbackZone={zone} /> : null}
      {items.length > 0 ? (
        <p className='visually-hidden' role='status'>
          {t('list.shown', { count: items.length })}
        </p>
      ) : null}
      {moreError ? <ErrorMessage error={moreError} /> : null}
      {list.hasNextPage ? (
        <button
          className='portal-button portal-button-secondary portal-show-more'
          type='button'
          onClick={() => void list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
        >
          {list.isFetchingNextPage ? t('list.loadingMore') : t('list.showMore')}
        </button>
      ) : null}
    </div>
  );
}
