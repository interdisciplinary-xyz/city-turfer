import type { T } from '@/i18n';

import { shareText } from './district-share';

export interface CityCardLabelInput {
  city: string;
  area: string;
  withTurf: string;
  total: string;
  /** The districts the card lists, most turf first. */
  top: readonly { name: string; share: number }[];
}

/**
 * The card's VoiceOver label: everything the card shows, since the card is one button and its
 * text is not reachable on its own (city, turf, districts lit, then the listed districts and
 * their shares).
 */
export function cityCardLabel(t: T<'turf'>, { top, ...counts }: CityCardLabelInput, locale?: string): string {
  const base = t('cityCard.label', counts);
  if (top.length === 0) {
    return base;
  }
  const districts = top
    .map((d) => t('cityCard.labelDistrict', { name: d.name, share: shareText(d.share, locale) }))
    .join('; ');
  return `${base}. ${t('cityCard.labelTop', { districts })}`;
}
