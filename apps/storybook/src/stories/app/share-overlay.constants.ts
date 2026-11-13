import type { ShareOverlayProps } from '@cityturfer/ui';

import busy from './share-photos/busy.svg';
import dark from './share-photos/dark.svg';
import white from './share-photos/white.svg';

/** Generated sample photos: the worst case (white), night and a busy one. */
export const SAMPLE_PHOTO = { white: { uri: white }, dark: { uri: dark }, busy: { uri: busy } } as const;

/** Served from packages/brand/svg (staticDirs, relative so it works under /storybook). */
export const WORDMARK = { uri: 'brand/wordmark.svg' };

/** Strings as the app formats them: English, a run. */
export const EN: Omit<ShareOverlayProps, 'width' | 'layout' | 'wordmark' | 'renderTypeIcon'> = {
  stats: [
    { label: 'Distance', value: '5.74', unit: 'km' },
    { label: 'Moving time', value: '34:44' },
    { label: 'Avg pace', value: '6:03', unit: '/km' },
  ],
  turfLine: '+128 new turf cells',
  title: 'Evening run',
  when: '9 Nov 2026 · 17:36',
  place: 'Oliwa, Gdańsk',
};

/** Polish, a ride: speed, the longest values and a title that needs two lines. */
export const PL: typeof EN = {
  stats: [
    { label: 'Dystans', value: '102,35', unit: 'km' },
    { label: 'Czas w ruchu', value: '1:34:44' },
    { label: 'Śr. prędkość', value: '24,8', unit: 'km/h' },
  ],
  turfLine: '+1234 nowe komórki terytorium',
  title: 'Popołudniowa przejażdżka wzdłuż Motławy i Wisły',
  when: '9 lis 2026 · 17:36',
  place: 'Gdańsk',
};

/** Card widths: a phone preview and the story's own pixels. */
export const PREVIEW_WIDTH = 360;
