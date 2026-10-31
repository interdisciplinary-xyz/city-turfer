import './hero-city.css';

import { heroCityOptions } from './city-options';
import { CITY_BOOT_SCRIPT, DEFAULT_HERO_CITY } from './hero-city.constants';
import { HeroMapPicker } from './hero-map-picker';

/**
 * The faint street map behind the hero. Renders Gdańsk; the inline script switches to the
 * visitor's city (time zone) before the first paint, so `data-city` may differ from the server
 * HTML (hence suppressHydrationWarning on this element only). The maps are the site's own files:
 * no request leaves the site.
 */
export function HeroCity() {
  return (
    <div className='hero-city' data-city={DEFAULT_HERO_CITY} suppressHydrationWarning>
      <div className='hero-map' aria-hidden='true' data-anim='map'>
        <i className='hero-map-water' />
        <i className='hero-map-streets' />
      </div>
      <script dangerouslySetInnerHTML={{ __html: CITY_BOOT_SCRIPT }} />
    </div>
  );
}

/** The line under the hero: which city, "Near me" and the OpenStreetMap credit. */
export function HeroCityLine() {
  return <HeroMapPicker cities={heroCityOptions()} />;
}
