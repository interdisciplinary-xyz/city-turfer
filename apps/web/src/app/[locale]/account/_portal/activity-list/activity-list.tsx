'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { activityHref } from '@/api/next-path';
import { Link } from '@/i18n/navigation';

import { activityNumbers } from '../activity-numbers';
import { groupByMonth, monthLabel, rowWhen } from '../activity-time';
import { previewLines, routeShape } from '../route-shape';
import { RouteSvg } from '../route-svg';
import { ROW_BOX, TYPE_TOKEN } from '../route-svg/route-svg.constants';
import type { ActivityListProps, ActivityRowProps, MonthProps } from './activity-list.constants';

/** The backed-up activities by month (of their own local day, H5), newest first. */
export function ActivityList({ items, locale, fallbackZone }: ActivityListProps) {
  return (
    <div className='portal-months'>
      {groupByMonth(items, fallbackZone).map((group) => (
        <Month key={group.key} label={monthLabel(locale, group.key)}>
          {group.items.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} locale={locale} fallbackZone={fallbackZone} />
          ))}
        </Month>
      ))}
    </div>
  );
}

function Month({ label, children }: MonthProps) {
  const id = useId();
  return (
    <section className='portal-month' aria-labelledby={id}>
      <h2 id={id} className='portal-month-title'>
        {label}
      </h2>
      <ol className='portal-activities'>{children}</ol>
    </section>
  );
}

/**
 * One activity: its shape from the summary's `preview` (decoration: the text says it all), name,
 * type, local day and time, Apple Health mark, and distance, moving time, pace or speed as the app
 * shows them. The whole row opens the activity.
 */
export function ActivityRow({ activity, locale, fallbackZone }: ActivityRowProps) {
  const t = useTranslations('portal.activities');
  const n = activityNumbers(activity, locale);
  return (
    <li className={`portal-activity portal-type-${TYPE_TOKEN[activity.type]}`}>
      <Link className='portal-activity-link' href={activityHref(activity.id)} locale={locale} prefetch={false}>
        <span className='portal-activity-shape'>
          <RouteSvg
            shape={routeShape(previewLines(activity.preview), ROW_BOX)}
            type={activity.type}
            dot={ROW_BOX.dot}
          />
        </span>
        <span className='portal-activity-text'>
          <span className='portal-activity-name'>{activity.name}</span>
          <span className='portal-activity-meta'>
            <span className='portal-type-label'>{t(`type.${activity.type}`)}</span>
            <span aria-hidden='true'> · </span>
            <time dateTime={activity.startedAt}>{rowWhen(locale, activity, fallbackZone)}</time>
            {activity.source === 'apple-health' ? <span className='portal-health'>{t('fromHealth')}</span> : null}
          </span>
        </span>
        <span className='portal-activity-stats'>
          <span>
            <span className='visually-hidden'>{t('stat.distance')}: </span>
            {n.estimated ? (
              <>
                <span aria-hidden='true'>≈ </span>
                <span className='visually-hidden'>{t('approx')} </span>
              </>
            ) : null}
            {n.distance.value}
            <span className='portal-unit'> {n.distance.unit}</span>
          </span>
          <span>
            <span className='visually-hidden'>, {t('stat.movingTime')}: </span>
            {n.moving}
          </span>
          <span>
            <span className='visually-hidden'>, {t('stat.average', { type: activity.type })}: </span>
            {n.pace.value}
            <span className='portal-unit'> {n.pace.unit}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
