import { useFormatter, useTranslations } from 'next-intl';

import {
  EXAMPLE_ACHIEVEMENTS,
  EXAMPLE_ACTIVITIES,
  EXAMPLE_WEEK,
  TYPE_CLASS,
  TYPE_GLYPH,
} from '../home-sections/home-sections.constants';
import { EXAMPLE_NAME, EXAMPLE_TURF } from './hero-screens.constants';
import { SettingsButton, StatusBar, TabBar } from './phone-chrome';

/**
 * The Dashboard as a coded prototype: greeting and turf line, the This week card, recent
 * activities and the achievements bar. Same example week as the Dashboard card under the hero.
 */
export function DashboardScreen() {
  const t = useTranslations('screens.proto.dashboard');
  const format = useFormatter();
  const km = (value: number) => format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const progress = Math.round((EXAMPLE_ACHIEVEMENTS.unlocked / EXAMPLE_ACHIEVEMENTS.total) * 100);
  return (
    <div className='proto proto-dashboard'>
      <StatusBar />
      <div className='proto-body'>
        <div className='proto-hello'>
          <div>
            <p className='proto-greeting'>{t('greeting', { name: EXAMPLE_NAME })}</p>
            <p className='proto-muted'>
              {t('subtitle', { area: km(EXAMPLE_TURF.areaKm2), week: km(EXAMPLE_TURF.weekKm2) })}
            </p>
          </div>
          <SettingsButton />
        </div>
        <div className='proto-card'>
          <p className='proto-card-title'>{t('thisWeek')}</p>
          <div className='proto-stats'>
            <span className='proto-stat'>
              <span>
                <span className='proto-stat-value'>{km(EXAMPLE_WEEK.distanceKm)}</span>
                <span className='proto-stat-unit'>{t('unitKm')}</span>
              </span>
              <span className='proto-label'>{t('distance')}</span>
            </span>
            <span className='proto-stat'>
              <span className='proto-stat-value'>{EXAMPLE_WEEK.time}</span>
              <span className='proto-label'>{t('time')}</span>
            </span>
            <span className='proto-stat'>
              <span className='proto-stat-value'>{EXAMPLE_WEEK.count}</span>
              <span className='proto-label'>{t('count')}</span>
            </span>
          </div>
        </div>
        <div className='proto-list-head'>
          <p className='proto-card-title'>{t('recent')}</p>
          <span className='proto-link'>{t('seeAll')}</span>
        </div>
        {EXAMPLE_ACTIVITIES.map((a) => (
          <div key={a.key} className='proto-row'>
            <span className={`proto-badge app-badge-${TYPE_CLASS[a.type]}`}>{TYPE_GLYPH[a.type]}</span>
            <span className='proto-row-main'>
              <span className='proto-row-title'>{t(`activities.${a.key}.title`)}</span>
              <span className='proto-muted'>{t(`activities.${a.key}.when`)}</span>
            </span>
            <span className='proto-row-end'>
              <span className='proto-row-value'>{t('rowDistance', { distance: km(a.distanceKm) })}</span>
              <span className='proto-muted'>
                {a.speedKmh === undefined
                  ? t('rowPace', { time: a.time, pace: a.pace ?? '' })
                  : t('rowSpeed', { time: a.time, speed: format.number(a.speedKmh, { maximumFractionDigits: 1 }) })}
              </span>
            </span>
          </div>
        ))}
        <div className='proto-card'>
          <div className='proto-list-head'>
            <p className='proto-card-title'>{t('achievements')}</p>
            <span className='proto-link'>
              {EXAMPLE_ACHIEVEMENTS.unlocked} / {EXAMPLE_ACHIEVEMENTS.total} ›
            </span>
          </div>
          <p className='proto-muted proto-next'>
            {t.rich('nextUp', { b: (chunks) => <strong className='proto-strong'>{chunks}</strong> })}
          </p>
          <span className='proto-track'>
            <span className='proto-fill' style={{ width: `${progress}%` }} />
          </span>
        </div>
      </div>
      <TabBar active='dashboard' />
    </div>
  );
}
