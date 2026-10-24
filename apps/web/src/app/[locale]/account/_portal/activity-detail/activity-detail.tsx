'use client';

import { useTranslations } from 'next-intl';
import { useId, useMemo } from 'react';

import { activitiesHref } from '@/api/next-path';
import { Link } from '@/i18n/navigation';

import { activityNumbers, splitPace } from '../activity-numbers';
import { detailWhen } from '../activity-time';
import { previewLines, routeShape, simplifyLines, trackLines } from '../route-shape';
import { RouteSvg } from '../route-svg';
import { DETAIL_BOX, TYPE_TOKEN } from '../route-svg/route-svg.constants';
import type { ActivityDetailViewProps } from './activity-detail.constants';

/**
 * One backed-up activity, read-only (H3): name, type, when (in its own zone), the stats as the app
 * shows them, the route's shape (segments solid, the parts between them dashed; no basemap) and
 * the kilometre splits.
 */
export function ActivityDetailView({
  activity,
  track,
  trackFailed = false,
  locale,
  browserZone,
}: ActivityDetailViewProps) {
  const t = useTranslations('portal.activities');
  const routeId = useId();
  const splitsId = useId();
  const n = activityNumbers(activity, locale);
  const shape = useMemo(() => {
    const lines = track ? simplifyLines(trackLines(track.points, activity.gapRoutes)) : previewLines(activity.preview);
    return routeShape(lines, DETAIL_BOX);
  }, [track, activity.gapRoutes, activity.preview]);
  const hasGaps = Boolean(shape?.gaps);
  const token = TYPE_TOKEN[activity.type];

  return (
    <article className={`portal-page portal-type-${token}`}>
      <p className='portal-back'>
        <Link href={activitiesHref()} locale={locale}>
          <span aria-hidden='true'>← </span>
          {t('detail.back')}
        </Link>
      </p>
      <header className='portal-detail-head'>
        <h1 className='portal-title'>{activity.name}</h1>
        <p className='portal-detail-meta'>
          <span className='portal-type-label'>{t(`type.${activity.type}`)}</span>
          <span aria-hidden='true'> · </span>
          <time dateTime={activity.startedAt}>{detailWhen(locale, activity, browserZone)}</time>
          {activity.source === 'apple-health' ? <span className='portal-health'>{t('fromHealth')}</span> : null}
        </p>
      </header>

      <section className='portal-card' aria-label={t('detail.statsTitle')}>
        <dl className='portal-stats'>
          <div className='portal-stat'>
            <dt>{t('stat.distance')}</dt>
            <dd>
              {n.estimated ? (
                <>
                  <span aria-hidden='true'>≈ </span>
                  <span className='visually-hidden'>{t('approx')} </span>
                </>
              ) : null}
              {n.distance.value}
              <span className='portal-unit'> {n.distance.unit}</span>
            </dd>
          </div>
          <div className='portal-stat'>
            <dt>{t('stat.movingTime')}</dt>
            <dd>{n.moving}</dd>
          </div>
          <div className='portal-stat'>
            <dt>{t('stat.average', { type: activity.type })}</dt>
            <dd>
              {n.pace.value}
              <span className='portal-unit'> {n.pace.unit}</span>
            </dd>
          </div>
          <div className='portal-stat'>
            <dt>{t('stat.elapsed')}</dt>
            <dd>{n.elapsed}</dd>
          </div>
          <div className='portal-stat'>
            <dt>{t('stat.elevation')}</dt>
            <dd>
              {n.elevation ?? '—'}
              {n.elevation ? <span className='portal-unit'> m</span> : null}
            </dd>
          </div>
        </dl>
        {n.estimated ? <p className='portal-hint'>{t('detail.estimatedNote', { distance: n.estimatedText })}</p> : null}
      </section>

      {shape ? (
        <section className='portal-card' aria-labelledby={routeId}>
          <h2 id={routeId} className='portal-card-title'>
            {t('detail.routeTitle')}
          </h2>
          <div className='portal-route-frame'>
            <RouteSvg
              shape={shape}
              type={activity.type}
              dot={DETAIL_BOX.dot}
              label={t('detail.routeLabel', { gaps: hasGaps ? 'yes' : 'no' })}
            />
          </div>
          {hasGaps ? (
            <ul className='portal-legend'>
              <li>
                <span className='portal-legend-line' aria-hidden='true' />
                {t('detail.routeRecorded')}
              </li>
              <li>
                <span className='portal-legend-line portal-legend-dashed' aria-hidden='true' />
                {t('detail.routeBetween')}
              </li>
            </ul>
          ) : null}
          {trackFailed ? <p className='portal-hint'>{t('detail.routeSimplified')}</p> : null}
          <p className='portal-hint'>{t('detail.routeNoMap')}</p>
        </section>
      ) : null}

      {activity.splits.length > 0 ? (
        <section className='portal-card' aria-labelledby={splitsId}>
          <h2 id={splitsId} className='portal-card-title'>
            {t('detail.splitsTitle')}
          </h2>
          <table className='portal-splits'>
            <thead>
              <tr>
                <th scope='col'>{t('detail.splitKm')}</th>
                <th scope='col'>{t('detail.splitValue', { type: activity.type })}</th>
              </tr>
            </thead>
            <tbody>
              {activity.splits.map((split) => {
                const value = splitPace(activity.type, split.movingS, locale);
                return (
                  <tr key={split.km}>
                    <th scope='row'>{t('detail.splitRow', { km: String(split.km) })}</th>
                    <td>
                      {value.value}
                      <span className='portal-unit'> {value.unit}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
    </article>
  );
}
