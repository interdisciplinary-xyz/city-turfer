// The language state only (no React, no secure store), so format stays pure and Jest-importable.
import { currentDateLocale, currentLocale } from '@/i18n/language-state';
import type { Locale } from '@/i18n/locales';
import { translator } from '@/i18n/translator';
import {
  type ActivityType,
  decimalMark,
  distanceText as coreDistanceText,
  fixed as coreFixed,
  formatArea as coreFormatArea,
  formatDistance as coreFormatDistance,
  formatDuration,
  formatPaceOrSpeed as coreFormatPaceOrSpeed,
  type FormattedQuantity,
  usesPace,
} from '@/shared-kernel';

/*
 * Numbers and dates in the app language (docs/decisions/mobile-i18n-2026-10-23.md, L6). Every
 * function takes the locale last and defaults to the app's current one, so call sites stay as they
 * are and tests pass a locale. Units stay metric symbols in every language. The number formatters
 * live in the shared kernel (@cityturfer/core, pure, locale required) so the web portal shows the
 * same digits (docs/plans/web-portal-history-2026-10-23.md, H4); here they get the app's locale.
 */

export { decimalMark, formatDuration };

/**
 * `n` with `digits` decimals, never grouped, in the locale's decimal mark (Hermes' Intl has no
 * `useGrouping`, so the digits come from `toFixed`).
 */
export function fixed(n: number, digits: number, locale: string = currentLocale()): string {
  return coreFixed(n, digits, locale);
}

export function formatDistance(m: number, locale: string = currentLocale()): FormattedQuantity {
  return coreFormatDistance(m, locale);
}

export const distanceText = (m: number, locale: string = currentLocale()): string => coreDistanceText(m, locale);

/** Pace (min/km) for walk/run, speed (km/h) for cycle. */
export function formatPaceOrSpeed(
  type: ActivityType,
  distanceM: number,
  seconds: number,
  locale: string = currentLocale()
): FormattedQuantity {
  return coreFormatPaceOrSpeed(type, distanceM, seconds, locale);
}

/** The live pace or speed from the current speed in m/s; `—` when standing (≤ 0.2 m/s) or unknown. */
export function formatSpeedNow(
  type: ActivityType,
  mps: number | null,
  locale: string = currentLocale()
): FormattedQuantity {
  if (mps == null || mps <= 0.2) {
    return { value: '—', unit: usesPace(type) ? '/km' : 'km/h' };
  }
  return coreFormatPaceOrSpeed(type, mps * 1000, 1000, locale);
}

/** Never grouped: thousands separators read as decimals in some locales (e.g. pl "37.495 m²"). */
export const formatArea = (km2: number, locale: string = currentLocale()): string => coreFormatArea(km2, locale);

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const dateFormat = (locale: string, options: Intl.DateTimeFormatOptions, id: string) => {
  const key = `${id}|${locale}`;
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, f);
  }
  return f;
};

/** Weekday, day, month and time, e.g. "Thu, Oct 22, 09:15 AM" (en-US) or "czw., 22 paź, 09:15" (pl). */
export function formatDate(ms: number, locale: string = currentDateLocale()): string {
  return dateFormat(
    locale,
    { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    'date'
  ).format(new Date(ms));
}

/** A calendar day, e.g. "Oct 22, 2026" (en-US), "22 Oct 2026" (en-GB) or "22 paź 2026" (pl). */
export function formatDay(ms: number, locale: string = currentDateLocale()): string {
  return dateFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }, 'day').format(new Date(ms));
}

/** A day and month in digits, e.g. "10/22" (en-US), "22/10" (en-GB) or "22.10" (pl): week labels on Stats. */
export function formatDayMonth(ms: number, locale: string = currentDateLocale()): string {
  return dateFormat(locale, { day: 'numeric', month: 'numeric' }, 'dayMonth').format(new Date(ms));
}

/** Day, month, year and time, e.g. "Oct 22, 2026, 09:15 AM" (en-US) or "22 paź 2026, 09:15" (pl). */
export function formatDateTime(ms: number, locale: string = currentDateLocale()): string {
  return dateFormat(
    locale,
    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    'dateTime'
  ).format(new Date(ms));
}

/**
 * The name to show for the signed-in Turfer: their chosen name, or "You" in the app language
 * (never an id or an email). Callers re-render on a language change through their own `useT`.
 */
export const shownName = (user: { name?: string | null } | null | undefined, locale?: Locale): string =>
  user?.name || translator('me', locale)('you');
