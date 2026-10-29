import './turf-demo.css';

import { useFormatter, useTranslations } from 'next-intl';

import { DEMO_TIERS, TURF_DEMO } from './turf-demo.constants';
import { TurfDemoPlayer } from './turf-demo-player';

const points = (flat: number[]) => {
  const out: string[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push(`${flat[i]},${flat[i + 1]}`);
  }
  return out.join(' ');
};

/**
 * The city's ~1,500 cells as round dots in one path (a zero-length line per cell, drawn with round
 * caps): at this scale a cell is ~5 px, where a dot reads like a hexagon at a quarter of the bytes.
 */
const dots = (flat: number[]) => {
  const out: string[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push(`M${flat[i]} ${flat[i + 1]}h0`);
  }
  return out.join('');
};

/**
 * "One street, four visits": a real stretch of the Gdańsk demo history lights up tier by tier, then
 * the whole city after four months. Geometry and tiers come from the app's own rules at build time
 * (apps/web/tools/gen-turf-demo.mjs); this page only draws numbers.
 */
export function TurfDemo() {
  const t = useTranslations('home.demo');
  const ttier = useTranslations('home.tiers');
  const format = useFormatter();
  const { view, street, city, totals, visitsPerTier } = TURF_DEMO;
  const steps = [
    ...DEMO_TIERS.map((tier) => t('step', { visits: visitsPerTier[tier], tier: ttier(tier) })),
    t('cityStep'),
  ];
  return (
    <section className='home-section' aria-labelledby='demo-title'>
      <div className='wrap home-split turf-demo'>
        <div className='home-split-copy'>
          <p className='home-eyebrow'>{t('eyebrow')}</p>
          <h2 id='demo-title' className='home-title'>
            {t('title')}
          </h2>
          <p className='home-lede'>{t('body')}</p>
        </div>
        <figure className='turf-demo-figure' aria-describedby='demo-caption'>
          <TurfDemoPlayer labels={{ steps, stepsLabel: t('stepsLabel'), replay: t('replay') }}>
            <svg
              className='turf-demo-svg'
              viewBox={`0 0 ${view.width} ${view.height}`}
              role='img'
              aria-label={t('alt', {
                faint: visitsPerTier.faint,
                glowing: visitsPerTier.glowing,
                strong: visitsPerTier.strong,
                blazing: visitsPerTier.blazing,
              })}
            >
              <g className='td-street'>
                {street.context.map((cell, i) => (
                  <polygon key={i} className='td-context' points={points(cell)} />
                ))}
                {street.lines.map((line, i) => (
                  <polyline key={i} className='td-line' points={points(line)} />
                ))}
                {street.cells.map((cell, i) => (
                  <polygon
                    key={i}
                    className='td-cell'
                    points={points(cell)}
                    style={{ transitionDelay: `${i * 45}ms` }}
                  />
                ))}
              </g>
              <g className='td-city'>
                {DEMO_TIERS.map((tier) => (
                  <path key={tier} className={`td-city-${tier}`} d={dots(city[tier])} strokeWidth={city.radius * 2} />
                ))}
              </g>
            </svg>
          </TurfDemoPlayer>
          <figcaption id='demo-caption' className='home-caption'>
            {t('caption', {
              activities: totals.activities,
              area: format.number(totals.areaKm2, { minimumFractionDigits: 2 }),
              cells: totals.cells,
            })}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
