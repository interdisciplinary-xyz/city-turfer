import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { describe, expect, test } from 'vitest';

import { MAP_CITY_IDS } from '../../../../../tools/gen-city-maps.mjs';
import { CITY_BOOT_SCRIPT, DEFAULT_HERO_CITY, HERO_CITY_IDS } from './hero-city.constants';
import { cityForTimeZone } from './pick-city';

const PUBLIC = fileURLToPath(new URL('../../../../../public/', import.meta.url));
const CSS = readFileSync(fileURLToPath(new URL('./hero-city.css', import.meta.url)), 'utf8');
/** Per city and layer, gzipped (docs/plans/hero-city-map-2026-10-28.md). */
const BUDGET_BYTES = 80 * 1024;

describe('time zone → city', () => {
  test('Polish visitors see Gdańsk, neighbours their capital, everyone else the default', () => {
    expect(cityForTimeZone('Europe/Warsaw')).toBe('pl-gdansk');
    expect(cityForTimeZone('Europe/Berlin')).toBe('de-berlin');
    expect(cityForTimeZone('Europe/London')).toBe('gb-london');
    expect(cityForTimeZone('America/New_York')).toBe(DEFAULT_HERO_CITY);
    expect(cityForTimeZone(undefined)).toBe(DEFAULT_HERO_CITY);
  });

  test('the boot script applies the same rule', () => {
    for (const [zone, city] of [
      ['Europe/Prague', 'cz-prague'],
      ['Asia/Tokyo', null],
    ] as const) {
      const el = { attr: null as string | null, setAttribute: (_: string, v: string) => (el.attr = v) };
      const run = new Function('document', 'Intl', CITY_BOOT_SCRIPT);
      run(
        { currentScript: { parentElement: el } },
        {
          DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }),
        }
      );
      expect(el.attr).toBe(city);
    }
  });
});

describe('every city is complete', () => {
  test('the generator draws the same cities', () => {
    expect([...MAP_CITY_IDS]).toEqual([...HERO_CITY_IDS]);
  });

  test.each(HERO_CITY_IDS)('%s has a CSS rule and both masks within budget', (id) => {
    expect(CSS).toContain(`.hero-city[data-city='${id}']`);
    for (const layer of ['streets', 'water']) {
      const file = `${PUBLIC}city-maps/${id}-${layer}.svg`;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(0);
      expect(gzipSync(readFileSync(file)).byteLength).toBeLessThan(BUDGET_BYTES);
    }
  });

  test('the masks carry no colour and no outside reference', () => {
    for (const id of HERO_CITY_IDS) {
      const svg = readFileSync(`${PUBLIC}city-maps/${id}-streets.svg`, 'utf8');
      expect(svg).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(svg).not.toMatch(/(href|src)=/);
    }
  });
});
