/**
 * The street map behind the hero (docs/plans/hero-city-map-2026-10-28.md). Ids are the app's Home
 * City catalogue ids (`@cityturfer/core` territory); each has two masks drawn by
 * `apps/web/tools/gen-city-maps.mjs` in `public/city-maps/`. Keep this list and the tool's
 * MAP_CITY_IDS the same (a test checks).
 */
export const HERO_CITY_IDS = [
  'pl-gdansk',
  'pl-warsaw',
  'pl-krakow',
  'pl-wroclaw',
  'pl-poznan',
  'de-berlin',
  'gb-london',
  'cz-prague',
  'lt-vilnius',
] as const;

export type HeroCityId = (typeof HERO_CITY_IDS)[number];

/** Shown without JavaScript, for unknown time zones and for every Polish one: the phones' city. */
export const DEFAULT_HERO_CITY: HeroCityId = 'pl-gdansk';

/**
 * Time zone → city. A zone only tells the country, so each country gets one city. Read in the
 * browser only; never stored or sent.
 */
export const TIME_ZONE_CITY: Readonly<Record<string, HeroCityId>> = {
  'Europe/Warsaw': 'pl-gdansk',
  'Europe/Berlin': 'de-berlin',
  'Europe/London': 'gb-london',
  'Europe/Prague': 'cz-prague',
  'Europe/Vilnius': 'lt-vilnius',
};

/** Attribute on the `.hero-city` element that holds the city id (CSS picks the masks from it). */
export const CITY_ATTRIBUTE = 'data-city';

/**
 * Runs inline right after the map element, before the first paint: picks the city for the
 * visitor's time zone and sets it on the map's container. No storage, no network.
 */
export const CITY_BOOT_SCRIPT = `(()=>{try{var m=${JSON.stringify(TIME_ZONE_CITY)};var c=m[Intl.DateTimeFormat().resolvedOptions().timeZone];var e=document.currentScript&&document.currentScript.parentElement;if(c&&e)e.setAttribute('${CITY_ATTRIBUTE}',c)}catch(e){}})();`;
