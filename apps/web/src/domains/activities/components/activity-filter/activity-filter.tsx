'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { type ActivityFilterProps, HISTORY_FILTERS } from './activity-filter.constants';

/** All / walks / runs / rides: native radio buttons (arrow keys move between them), styled as chips. */
export function ActivityFilter({ value, onChange }: ActivityFilterProps) {
  const t = useTranslations('portal.activities.filter');
  const name = useId();
  return (
    <fieldset className='portal-filter'>
      <legend className='portal-filter-legend'>{t('label')}</legend>
      <div className='portal-filter-options'>
        {HISTORY_FILTERS.map((option) => (
          <label key={option} className='portal-chip'>
            <input
              type='radio'
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{t(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
