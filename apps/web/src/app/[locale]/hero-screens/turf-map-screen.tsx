import { useFormatter, useTranslations } from 'next-intl';

import { HOME_TYPES, TYPE_CLASS, TYPE_GLYPH } from '../home-sections/home-sections.constants';
import {
  EXAMPLE_TURF,
  MAP_HOME,
  MAP_LABELS,
  MAP_RIVER,
  MAP_ROUTES,
  MAP_STREETS,
  PROTO_HEIGHT,
  PROTO_WIDTH,
} from './hero-screens.constants';
import { SettingsButton, StatusBar, TabBar } from './phone-chrome';
import { smoothPath } from './smooth-path';

/**
 * The Turf Map as a coded prototype: a stylised dark map (streets, river, district names) with the
 * turf routes glowing in the Ramp, the "Your turf" card with the type filters, and the tab bar.
 */
export function TurfMapScreen() {
  const t = useTranslations('screens.proto');
  const tt = useTranslations('home.types');
  const format = useFormatter();
  const km2 = (value: number) => format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className='proto proto-map'>
      <svg
        className='proto-map-art'
        viewBox={`0 0 ${PROTO_WIDTH} ${PROTO_HEIGHT}`}
        preserveAspectRatio='xMidYMid slice'
        aria-hidden='true'
      >
        <defs>
          <filter id='proto-glow' filterUnits='userSpaceOnUse' x='0' y='0' width={PROTO_WIDTH} height={PROTO_HEIGHT}>
            <feGaussianBlur stdDeviation='5' />
          </filter>
        </defs>
        <path className='proto-river' d={MAP_RIVER} />
        {MAP_STREETS.map((d) => (
          <path key={d} className='proto-street' d={d} />
        ))}
        {MAP_LABELS.map(({ name, x, y }) => (
          <text key={name} className='proto-district' x={x} y={y}>
            {name}
          </text>
        ))}
        <text className='proto-district proto-city' x='236' y='490'>
          {t('turf.city')}
        </text>
        {MAP_ROUTES.map(({ points, tier }) => {
          const d = smoothPath(points);
          return (
            <g key={d} className={`proto-route proto-route-${tier}`}>
              <path className='proto-route-halo' d={d} filter='url(#proto-glow)' />
              <path className='proto-route-line' d={d} />
              <path className='proto-route-core' d={d} />
            </g>
          );
        })}
        <circle className='proto-home-ring' cx={MAP_HOME.x} cy={MAP_HOME.y} r='9' />
        <circle className='proto-home' cx={MAP_HOME.x} cy={MAP_HOME.y} r='6' />
      </svg>
      <StatusBar />
      <div className='proto-turf-card'>
        <div className='proto-turf-head'>
          <div>
            <p className='proto-label'>{t('turf.title')}</p>
            <p className='proto-turf-area'>{t('turf.area', { area: km2(EXAMPLE_TURF.areaKm2) })}</p>
          </div>
          <SettingsButton />
        </div>
        <p className='proto-muted'>
          {t('turf.summary', {
            cellCount: EXAMPLE_TURF.cells,
            cells: EXAMPLE_TURF.cells,
            strongCount: EXAMPLE_TURF.strong,
            strong: EXAMPLE_TURF.strong,
            week: km2(EXAMPLE_TURF.weekKm2),
          })}
        </p>
        <div className='proto-chips'>
          {HOME_TYPES.map((type) => (
            <span key={type} className={`proto-chip app-chip-${TYPE_CLASS[type]}`}>
              <span>{TYPE_GLYPH[type]}</span>
              {tt(type)}
            </span>
          ))}
          <span className='proto-chip proto-chip-all'>⤢ {t('turf.all')}</span>
        </div>
      </div>
      <TabBar active='turf' />
    </div>
  );
}
