import './home-sections.css';

import { useFormatter, useTranslations } from 'next-intl';

import {
  EXAMPLE_ACHIEVEMENTS,
  EXAMPLE_ACTIVITIES,
  EXAMPLE_GAIN,
  EXAMPLE_WEEK,
  HOME_TIERS,
  HOME_TYPES,
  TYPE_CLASS,
  TYPE_GLYPH,
} from './home-sections.constants';

/**
 * The homepage below the hero, drawn in the app's own pieces (the @cityturfer/ui specs as CSS):
 * Card, Stat, ActivityRow, the type chips, the Record button and the Turf legend. Same tokens as
 * the app, so the site reads as the app's front door (docs/decisions/brand-dark-site-2026-10-25.md).
 */

/** The core loop in three app cards: record, turf gained, watch it glow. */
export function HowItWorks() {
  const t = useTranslations('home.how');
  const tt = useTranslations('home.types');
  const ttier = useTranslations('home.tiers');
  const format = useFormatter();
  return (
    <section className='home-section' aria-labelledby='how-title'>
      <div className='wrap'>
        <p className='home-eyebrow'>{t('eyebrow')}</p>
        <h2 id='how-title' className='home-title'>
          {t('title')}
        </h2>
        <ol className='home-steps'>
          <li className='app-card home-step'>
            <span className='home-step-n' aria-hidden='true'>
              1
            </span>
            <div className='home-chips' aria-hidden='true'>
              {HOME_TYPES.map((type) => (
                <span key={type} className={`app-chip app-chip-${TYPE_CLASS[type]}`}>
                  <span>{TYPE_GLYPH[type]}</span>
                  {tt(type)}
                </span>
              ))}
            </div>
            <span className='app-record' aria-hidden='true'>
              <span className='app-record-dot' />
            </span>
            <h3 className='app-card-title'>{t('record.title')}</h3>
            <p className='home-step-body'>{t('record.body')}</p>
          </li>
          <li className='app-card home-step'>
            <span className='home-step-n' aria-hidden='true'>
              2
            </span>
            <div className='app-gain' aria-hidden='true'>
              <p className='app-label'>{t('gain.label')}</p>
              <p className='app-gain-area'>
                {t('gain.area', { area: format.number(EXAMPLE_GAIN.areaKm2, { minimumFractionDigits: 2 }) })}
              </p>
              <p className='app-muted'>
                {t('gain.cells', {
                  added: EXAMPLE_GAIN.added,
                  reinforced: EXAMPLE_GAIN.reinforced,
                })}
              </p>
            </div>
            <h3 className='app-card-title'>{t('gain.title')}</h3>
            <p className='home-step-body'>{t('gain.body')}</p>
          </li>
          <li className='app-card home-step'>
            <span className='home-step-n' aria-hidden='true'>
              3
            </span>
            <div className='app-legend' role='img' aria-label={t('glow.legendLabel')}>
              <p className='app-label'>{t('glow.legendTitle')}</p>
              <div className='app-legend-bar'>
                {HOME_TIERS.map((tier) => (
                  <span key={tier} className={`app-legend-step app-legend-${tier}`} />
                ))}
              </div>
              <div className='app-legend-labels' aria-hidden='true'>
                {HOME_TIERS.map((tier) => (
                  <span key={tier}>{ttier(tier)}</span>
                ))}
              </div>
            </div>
            <h3 className='app-card-title'>{t('glow.title')}</h3>
            <p className='home-step-body'>{t('glow.body')}</p>
          </li>
        </ol>
      </div>
    </section>
  );
}

/** The Dashboard, as a web card: this week, recent activities, the next achievement. */
export function YourWeek() {
  const t = useTranslations('home.week');
  const format = useFormatter();
  const km = (value: number) => format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const progress = Math.round((EXAMPLE_ACHIEVEMENTS.unlocked / EXAMPLE_ACHIEVEMENTS.total) * 100);
  return (
    <section className='home-section home-week' aria-labelledby='week-title'>
      <div className='wrap home-split'>
        <div className='home-split-copy'>
          <p className='home-eyebrow'>{t('eyebrow')}</p>
          <h2 id='week-title' className='home-title'>
            {t('title')}
          </h2>
          <p className='home-lede'>{t('body')}</p>
        </div>
        <figure className='home-dashboard' aria-describedby='week-caption'>
          <div className='app-card'>
            <h3 className='app-card-title'>{t('thisWeek')}</h3>
            <div className='app-stats'>
              <div className='app-stat'>
                <span className='app-stat-figure'>
                  <span className='app-stat-value'>{km(EXAMPLE_WEEK.distanceKm)}</span>
                  <span className='app-stat-unit'>{t('unitKm')}</span>
                </span>
                <span className='app-label'>{t('distance')}</span>
              </div>
              <div className='app-stat'>
                <span className='app-stat-figure'>
                  <span className='app-stat-value'>{EXAMPLE_WEEK.time}</span>
                </span>
                <span className='app-label'>{t('time')}</span>
              </div>
              <div className='app-stat'>
                <span className='app-stat-figure'>
                  <span className='app-stat-value'>{EXAMPLE_WEEK.count}</span>
                </span>
                <span className='app-label'>{t('count')}</span>
              </div>
            </div>
          </div>
          <div className='app-list-head'>
            <h3 className='app-card-title'>{t('recent')}</h3>
            <span className='app-link' aria-hidden='true'>
              {t('seeAll')}
            </span>
          </div>
          <ul className='app-rows'>
            {EXAMPLE_ACTIVITIES.map((a) => (
              <li key={a.key} className='app-row'>
                <span className={`app-badge app-badge-${TYPE_CLASS[a.type]}`} aria-hidden='true'>
                  {TYPE_GLYPH[a.type]}
                </span>
                <span className='app-row-main'>
                  <span className='app-row-title'>{t(`activities.${a.key}.title`)}</span>
                  <span className='app-row-small'>{t(`activities.${a.key}.when`)}</span>
                </span>
                <span className='app-row-end'>
                  <span className='app-row-value'>{t('rowDistance', { distance: km(a.distanceKm) })}</span>
                  <span className='app-row-small'>
                    {a.speedKmh === undefined
                      ? t('rowPace', { time: a.time, pace: a.pace ?? '' })
                      : t('rowSpeed', {
                          time: a.time,
                          speed: format.number(a.speedKmh, { maximumFractionDigits: 1 }),
                        })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className='app-card'>
            <div className='app-list-head'>
              <h3 className='app-card-title'>{t('achievements')}</h3>
              <span className='app-link'>
                {EXAMPLE_ACHIEVEMENTS.unlocked} / {EXAMPLE_ACHIEVEMENTS.total}
              </span>
            </div>
            <p className='app-row-small'>
              {t.rich('nextUp', { b: (chunks) => <strong className='app-strong'>{chunks}</strong> })}
            </p>
            <div
              className='app-track'
              role='progressbar'
              aria-label={t('achievements')}
              aria-valuemin={0}
              aria-valuemax={EXAMPLE_ACHIEVEMENTS.total}
              aria-valuenow={EXAMPLE_ACHIEVEMENTS.unlocked}
            >
              <span className='app-fill' style={{ width: `${progress}%` }} />
            </div>
          </div>
          <figcaption id='week-caption' className='home-caption'>
            {t('caption')}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/** Local-first, in the app's words: the phone keeps the original, backup is opt-in. */
export function LocalFirst() {
  const t = useTranslations('home.local');
  return (
    <section className='home-section' aria-labelledby='local-title'>
      <div className='wrap'>
        <div className='app-card home-local'>
          <span className='home-local-icon' aria-hidden='true'>
            📱
          </span>
          <div>
            <p className='home-eyebrow'>{t('eyebrow')}</p>
            <h2 id='local-title' className='home-title home-title-small'>
              {t('title')}
            </h2>
            <ul className='home-points'>
              <li>{t('phone')}</li>
              <li>{t('backup')}</li>
              <li>{t('portal')}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Closing call to action: back up to the waitlist form under the hero (only when it is set up). */
export function FinalCta() {
  const t = useTranslations('home.cta');
  return (
    <section className='home-section home-cta' aria-labelledby='cta-title'>
      <div className='wrap'>
        <h2 id='cta-title' className='home-title'>
          {t('title')}
        </h2>
        <p className='home-lede'>{t('body')}</p>
        <a className='app-button' href='#waitlist'>
          {t('join')}
        </a>
      </div>
    </section>
  );
}
