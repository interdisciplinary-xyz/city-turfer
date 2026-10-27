import '../home-sections/home-sections.css';
import './hero-screens.css';

import { useTranslations } from 'next-intl';

import { DashboardScreen } from './dashboard-screen';
import { HERO_SCREENS } from './hero-screens.constants';
import { TurfMapScreen } from './turf-map-screen';

/**
 * The two phones with captions. Each screen is a coded prototype of the app on a 390 × 844 canvas
 * (Turf Map, Dashboard), drawn from the brand tokens and scaled to the frame, so it stays sharp,
 * speaks the page's language and matches the app's pieces below the hero.
 */
export function HeroScreens() {
  const t = useTranslations('screens');
  return (
    <div className='screens' data-anim-group='screens'>
      {HERO_SCREENS.map((key) => (
        <figure key={key} className='screen' data-anim='phone'>
          <div className='phone'>
            <div className='proto-screen' role='img' aria-label={t(`${key}.alt`)}>
              <div aria-hidden='true'>{key === 'turfMap' ? <TurfMapScreen /> : <DashboardScreen />}</div>
            </div>
          </div>
          <figcaption>
            <strong>{t(`${key}.title`)}</strong>
            {t(`${key}.body`)}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
