import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect } from 'react';

import { HeroCity, HeroCityLine } from '@/app/[locale]/hero-city';
import { HERO_CITY_IDS, type HeroCityId } from '@/app/[locale]/hero-city/hero-city.constants';

/** The hero's map layer and city line on their own, in a hero-sized box, for one city. */
function HeroCityPreview({ city }: { city: HeroCityId }) {
  useEffect(() => {
    document.querySelector('.hero-city')?.setAttribute('data-city', city);
  }, [city]);
  return (
    <div className='hero' style={{ minHeight: 640 }}>
      <HeroCity />
      <div style={{ flex: 1 }} />
      <HeroCityLine />
    </div>
  );
}

const meta = {
  title: 'Website/Hero city map',
  component: HeroCityPreview,
  args: { city: 'pl-gdansk' },
  argTypes: { city: { control: 'select', options: HERO_CITY_IDS } },
  parameters: {
    docs: {
      description: {
        component:
          'The faint street map behind the hero (docs/plans/hero-city-map-2026-10-28.md). Maps are colourless SVG masks in apps/web/public/city-maps, drawn once from OpenStreetMap by apps/web/tools/gen-city-maps.mjs and coloured by brand variables. On the site the city comes from the time zone before the first paint; "Near me" asks for the location only on click and keeps only the nearest city.',
      },
    },
  },
} satisfies Meta<typeof HeroCityPreview>;

export default meta;

export const Gdansk: StoryObj<typeof meta> = {};
export const Warsaw: StoryObj<typeof meta> = { args: { city: 'pl-warsaw' } };
export const London: StoryObj<typeof meta> = { args: { city: 'gb-london' } };
