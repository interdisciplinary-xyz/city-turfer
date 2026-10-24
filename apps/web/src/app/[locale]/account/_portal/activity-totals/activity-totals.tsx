'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { totalsNumbers } from '../activity-numbers';
import { TYPE_TOKEN } from '../route-svg/route-svg.constants';
import { type ActivityTotalsProps, totalsTiles } from './activity-totals.constants';

/** All-time totals of the backed-up copy, as the app's Stats tab counts them: all, then per type. */
export function ActivityTotals({ totals, locale }: ActivityTotalsProps) {
  const t = useTranslations('portal.activities');
  const id = useId();
  return (
    <section className='portal-card' aria-labelledby={id}>
      <h2 id={id} className='portal-card-title'>
        {t('totals.title')}
      </h2>
      <ul className='portal-totals'>
        {totalsTiles(totals).map(({ key, totals: tile }) => {
          const { distance, moving } = totalsNumbers(tile, locale);
          return (
            <li key={key} className={`portal-total${key === 'all' ? '' : ` portal-type-${TYPE_TOKEN[key]}`}`}>
              <span className='portal-total-label'>{key === 'all' ? t('totals.all') : t(`filter.${key}`)}</span>
              <span className='portal-total-value'>
                {distance.value}
                <span className='portal-unit'> {distance.unit}</span>
              </span>
              <span className='portal-total-meta'>{t('totals.meta', { count: tile.count, duration: moving })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
