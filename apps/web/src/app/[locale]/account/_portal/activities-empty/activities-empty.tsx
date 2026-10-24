'use client';

import { useTranslations } from 'next-intl';

import { Notice } from '../notice';
import type { ActivitiesEmptyProps } from './activities-empty.constants';

/** Nothing to list: why, and that everything is still on the phone. */
export function ActivitiesEmpty({ kind, type }: ActivitiesEmptyProps) {
  const t = useTranslations('portal.activities.empty');
  return (
    <Notice>
      {kind === 'never' ? <p>{t('never')}</p> : null}
      {kind === 'withdrawn' ? <p>{t('withdrawn')}</p> : null}
      {kind === 'nothing-yet' ? <p>{t('nothingYet')}</p> : null}
      {kind === 'filter' ? <p>{t('filter', { type: type ?? 'cycle' })}</p> : null}
      {kind === 'unknown' ? <p>{t('unknown')}</p> : null}
      {kind === 'never' || kind === 'withdrawn' ? <p className='portal-hint'>{t('howTo')}</p> : null}
    </Notice>
  );
}
