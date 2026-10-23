// The language state only (no React, no secure store), so format stays pure and Jest-importable.
import { currentDateLocale, currentLocale } from '@/i18n/language-state';
import type { Locale } from '@/i18n/locales';
import { translator } from '@/i18n/translator';
import { type ActivityType, usesPace } from '@/shared-kernel';

/*
 * Numbers and dates in the app language (docs/decisions/mobile-i18n-2026-10-23.md, L6). Every
 * function takes the locale last and defaults to the app's current one, so call sites stay as they
 * are and tests pass a locale. Units stay metric symbols in every language.
 */

const marks = new Map<string, string>();

/** The locale's decimal mark, from Intl: `.` in English, `,` in Polish. */
export function decimalMark(locale: string): string {
  let mark = marks.get(locale);
  if (mark === undefined) {
    try {
      mark = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        .format(1.5)
        .replace(/\d/g, '');
    } catch {
      mark = '.';
    }
    if (mark.length !== 1) {
      mark = '.';
    }
    marks.set(locale, mark);
  }
  return mark;
}

/**
 * `n` with `digits` decimals, never grouped, in the locale's decimal mark: the digits of `toFixed`
 * (English output unchanged), only the mark localised. Hermes' Intl.NumberFormat has no
 * `useGrouping` option, so grouping-free output cannot come from Intl itself.
 */
export function fixed(n: number, digits: number, locale: string = currentLocale()): string {
  const s = n.toFixed(digits);
  const mark = decimalMark(locale);
  return mark === '.' ? s : s.replace('.', mark);
}

export function formatDistance(m: number, locale: string = currentLocale()): { value: string; unit: string } {
  if (m < 1000) {
    return { value: String(Math.round(m)), unit: 'm' };
  }
  return { value: fixed(m / 1000, m < 100_000 ? 2 : 1, locale), unit: 'km' };
}
export const distanceText = (m: number, locale: string = currentLocale()) => {
  const d = formatDistance(m, locale);
  return `${d.value} ${d.unit}`;
};

export function formatDuration(s: number): string {
  const sec = Math.max(0, Math.round(s));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

/** Pace (min/km) for walk/run, speed (km/h) for cycle. */
export function formatPaceOrSpeed(
  type: ActivityType,
  distanceM: number,
  seconds: number,
  locale: string = currentLocale()
): { value: string; unit: string } {
  if (usesPace(type)) {
    if (distanceM < 50 || seconds <= 0) {
      return { value: '—', unit: '/km' };
    }
    const pace = seconds / (distanceM / 1000);
    if (pace > 60 * 60) {
      return { value: '—', unit: '/km' };
    }
    return { value: formatDuration(pace), unit: '/km' };
  }
  if (seconds <= 0) {
    return { value: '—', unit: 'km/h' };
  }
  return { value: fixed((distanceM / seconds) * 3.6, 1, locale), unit: 'km/h' };
}

export function formatSpeedNow(
  type: ActivityType,
  mps: number | null,
  locale: string = currentLocale()
): { value: string; unit: string } {
  if (mps == null || mps <= 0.2) {
    return { value: '—', unit: usesPace(type) ? '/km' : 'km/h' };
  }
  return formatPaceOrSpeed(type, mps * 1000, 1000, locale);
}

/** Never grouped: thousands separators read as decimals in some locales (e.g. pl "37.495 m²"). */
export const formatArea = (km2: number, locale: string = currentLocale()) =>
  km2 >= 0.01 ? `${fixed(km2, 2, locale)} km²` : `${Math.round(km2 * 1e6)} m²`;

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
