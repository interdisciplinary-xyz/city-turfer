import { type ActivityType, usesPace } from './activity-type';

/*
 * Numbers in a given language, shared by the app and the web portal so both show the same digits
 * (docs/decisions/mobile-i18n-2026-10-23.md, L6; docs/plans/web-portal-history-2026-10-23.md, H4).
 * Pure: the caller passes the locale (the app its current language, the web the page's). Units stay
 * metric symbols in every language; values in SI (metres, seconds, km²).
 */

/** A number ready to show and its unit symbol, kept apart so the UI can style them differently. */
export interface FormattedQuantity {
  value: string;
  unit: string;
}

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
export function fixed(n: number, digits: number, locale: string): string {
  const s = n.toFixed(digits);
  const mark = decimalMark(locale);
  return mark === '.' ? s : s.replace('.', mark);
}

/** Whole metres under 1 km, then km with 2 decimals (1 from 100 km). */
export function formatDistance(m: number, locale: string): FormattedQuantity {
  if (m < 1000) {
    return { value: String(Math.round(m)), unit: 'm' };
  }
  return { value: fixed(m / 1000, m < 100_000 ? 2 : 1, locale), unit: 'km' };
}

/** `formatDistance` as one string, e.g. "2.50 km". */
export function distanceText(m: number, locale: string): string {
  const d = formatDistance(m, locale);
  return `${d.value} ${d.unit}`;
}

/** `m:ss`, or `h:mm:ss` from one hour; negative durations show as 0:00. Locale-free. */
export function formatDuration(s: number): string {
  const sec = Math.max(0, Math.round(s));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Pace (min/km) for walk/run, speed (km/h) for cycle. `—` when there is nothing meaningful to
 * show: under 50 m or no time, a pace slower than 1 h/km, or a ride with no time.
 */
export function formatPaceOrSpeed(
  type: ActivityType,
  distanceM: number,
  seconds: number,
  locale: string
): FormattedQuantity {
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

/** Never grouped: thousands separators read as decimals in some locales (e.g. pl "37.495 m²"). */
export function formatArea(km2: number, locale: string): string {
  return km2 >= 0.01 ? `${fixed(km2, 2, locale)} km²` : `${Math.round(km2 * 1e6)} m²`;
}
