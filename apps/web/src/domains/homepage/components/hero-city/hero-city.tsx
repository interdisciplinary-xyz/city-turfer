import './hero-city.css';

import { useTranslations } from 'next-intl';

import { CITY_BOOT_SCRIPT, DEFAULT_HERO_CITY } from './hero-city.constants';

/**
 * The faint street map behind the hero. Renders Gdańsk; the inline script switches to the
 * visitor's city (time zone) before the first paint, so `data-city` may differ from the server
 * HTML (hence suppressHydrationWarning on this element only). The maps are the site's own files:
 * no request leaves the site. The map is OpenStreetMap data (ODbL), so a small credit sits in the
 * hero's bottom-right corner, above the map and clear of the hero's content.
 */
export function HeroCity() {
  const t = useTranslations('hero');
  const ta = useTranslations('a11y');
  return (
    <>
      <div className='hero-city' data-city={DEFAULT_HERO_CITY} suppressHydrationWarning>
        <div className='hero-map' aria-hidden='true' data-anim='map'>
          <i className='hero-map-water' />
          <i className='hero-map-streets' />
        </div>
        <script dangerouslySetInnerHTML={{ __html: CITY_BOOT_SCRIPT }} />
      </div>
      <a
        className='hero-map-credit'
        href='https://www.openstreetmap.org/copyright'
        rel='noopener noreferrer'
        target='_blank'
      >
        {t('mapCredit')}
        <span className='visually-hidden'> {ta('newTab')}</span>
      </a>
    </>
  );
}
