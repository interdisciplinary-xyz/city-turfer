// The language state and translator only (no React, no secure store), as ui-kit/format does.
import { currentDateLocale, currentLocale } from '@/i18n/language-state';
import type { Locale } from '@/i18n/locales';
import { translator } from '@/i18n/translator';
import { formatDay, formatDistance, formatDuration, formatPaceOrSpeed, formatTime } from '@/ui-kit/format';

import type { ShareCardFormat } from '../index';

const LABEL = {
  distance: 'card.distance',
  movingTime: 'card.movingTime',
  pace: 'card.pace',
  speed: 'card.speed',
} as const;

/**
 * The card's formatting in one language: the activity screen's formatters (`ui-kit/format`) and the
 * `share` messages. `dateLocale` is the regional variant dates use (`currentDateLocale()`).
 */
export function shareCardFormat(
  locale: Locale = currentLocale(),
  dateLocale: string = currentDateLocale()
): ShareCardFormat {
  const t = translator('share', locale);
  return {
    distance: (m) => formatDistance(m, locale),
    duration: formatDuration,
    paceOrSpeed: (type, m, s) => formatPaceOrSpeed(type, m, s, locale),
    day: (ms) => formatDay(ms, dateLocale),
    time: (ms) => formatTime(ms, dateLocale),
    label: (key) => t(LABEL[key]),
    turfCells: (cells) => t('card.turfCells', { cells }),
    when: (date, time) => t('card.when', { date, time }),
    placeDistrict: (district, city) => t('card.placeDistrict', { district, city }),
  };
}
