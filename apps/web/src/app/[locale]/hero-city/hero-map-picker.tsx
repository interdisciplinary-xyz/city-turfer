'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { CITY_ATTRIBUTE, DEFAULT_HERO_CITY, type HeroMapPickerProps, type LocateStatus } from './hero-city.constants';
import { asHeroCityId, nearestCity } from './pick-city';

/** The hero's map layer (one per page); it holds the city in `data-city`. */
const mapElement = () => document.querySelector<HTMLElement>('.hero-city');

/**
 * The line under the hero map: "Streets of [city ▾] · Near me · © OpenStreetMap contributors".
 * The city lives in the `data-city` attribute of the `.hero-city` map layer (set before paint by
 * the boot script); this component reads and writes it, and CSS swaps the map. "Near me" asks for
 * the location only on click, picks the nearest city on the device and forgets the position.
 */
export function HeroMapPicker({ cities }: HeroMapPickerProps) {
  const t = useTranslations('hero.map');
  const [status, setStatus] = useState<LocateStatus>('idle');

  const subscribe = useCallback((onChange: () => void) => {
    const el = mapElement();
    if (!el) {
      return () => {};
    }
    const observer = new MutationObserver(onChange);
    observer.observe(el, { attributes: true, attributeFilter: [CITY_ATTRIBUTE] });
    return () => observer.disconnect();
  }, []);
  const city =
    useSyncExternalStore(
      subscribe,
      () => asHeroCityId(mapElement()?.getAttribute(CITY_ATTRIBUTE)),
      () => DEFAULT_HERO_CITY
    ) ?? DEFAULT_HERO_CITY;

  const choose = (id: string) => {
    const known = asHeroCityId(id);
    if (known) {
      mapElement()?.setAttribute(CITY_ATTRIBUTE, known);
    }
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // Only the nearest city id is kept; the position itself is dropped here.
        const near = nearestCity({ lat: coords.latitude, lon: coords.longitude }, cities);
        if (near) {
          choose(near);
          setStatus('idle');
        } else {
          setStatus('tooFar');
        }
      },
      () => setStatus('unavailable'),
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 15_000 }
    );
  };

  return (
    <p className='hero-map-credit'>
      <label>
        <span>{t('streetsOf')}</span>
        <select value={city} onChange={(e) => choose(e.target.value)} aria-label={t('chooseCity')}>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {t(`cities.${c.id}`)}
            </option>
          ))}
        </select>
      </label>
      <button type='button' onClick={locate} disabled={status === 'locating'}>
        {status === 'locating' ? t('locating') : t('nearMe')}
      </button>
      <a href='https://www.openstreetmap.org/copyright' rel='noopener noreferrer' target='_blank'>
        {t('credit')}
      </a>
      <span className='hero-map-status' role='status'>
        {status === 'tooFar' ? t('tooFar') : status === 'unavailable' ? t('unavailable') : ''}
      </span>
    </p>
  );
}
