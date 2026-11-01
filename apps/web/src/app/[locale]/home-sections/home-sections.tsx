import './home-sections.css';

import { useFormatter, useTranslations } from 'next-intl';

import { TurfDemo } from '../turf-demo';
import {
  APP_VARIABLES,
  EXAMPLE_GAIN,
  HOME_TIERS,
  HOME_TYPES,
  LOCAL_POINTS,
  SECTION_ANCHORS,
  TYPE_CLASS,
  TYPE_GLYPH,
} from './home-sections.constants';
import { Section, SectionHead } from './section';

/**
 * The homepage below the hero, drawn in the app's own pieces (the @cityturfer/ui specs as CSS):
 * Card, Stat, ActivityRow, the type chips, the Record button and the Turf legend. Same tokens as
 * the app, so the site reads as the app's front door (docs/decisions/brand-light-website-2026-10-29.md). Pieces that draw turf tiers are night panels
 * (APP_VARIABLES), the rest follows the light page.
 */

/** The core loop in three app cards (record, turf gained, every return counts), then the glow demo as the payoff. */
export function HowItWorks() {
  const t = useTranslations('home.how');
  const tt = useTranslations('home.types');
  const ttier = useTranslations('home.tiers');
  const format = useFormatter();
  return (
    <Section name='how'>
      <SectionHead name='how' eyebrow={t('eyebrow')} title={t('title')} />
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
          <span className='app-record' style={APP_VARIABLES} aria-hidden='true'>
            <span className='app-record-dot' />
          </span>
          <h3 className='app-card-title'>{t('record.title')}</h3>
          <p className='home-step-body'>{t('record.body')}</p>
        </li>
        <li className='app-card home-step'>
          <span className='home-step-n' aria-hidden='true'>
            2
          </span>
          <div className='app-gain' style={APP_VARIABLES} aria-hidden='true'>
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
          <div className='app-legend' style={APP_VARIABLES} role='img' aria-label={t('glow.legendLabel')}>
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
      <TurfDemo />
    </Section>
  );
}

/**
 * Local-first, in the app's words: the phone keeps the original, backup is opt-in, and exactly what
 * does leave the phone (docs/product/launch-readiness.md, "What leaves the phone").
 */
export function LocalFirst() {
  const t = useTranslations('home.local');
  return (
    <Section name='privacy'>
      <SectionHead name='privacy' eyebrow={t('eyebrow')} title={t('title')} />
      <ul className='home-points home-privacy'>
        {LOCAL_POINTS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </Section>
  );
}

/** Closing call to action: back up to the waitlist form under the hero (only when it is set up). */
export function FinalCta() {
  const t = useTranslations('home.cta');
  return (
    <Section name='cta' className='home-cta'>
      <SectionHead name='cta' eyebrow={t('eyebrow')} title={t('title')} lede={t('body')} align='center' />
      <a className='btn btn-primary' href={`#${SECTION_ANCHORS.waitlist}`}>
        {t('join')}
      </a>
    </Section>
  );
}
