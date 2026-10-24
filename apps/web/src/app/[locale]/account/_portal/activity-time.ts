// When an activity happened, as the phone recorded it (docs/plans/web-portal-history-2026-10-23.md,
// H5): day and time in the activity's own IANA `timeZone`, the browser's zone when it is null or
// unknown to this browser; months group by that local day. Pure (the zone fallback is a parameter),
// so tests pin it. Other portal dates (sign-in, devices) use format.ts: the visitor's zone. Both
// take the route locale and format with format.ts's `dateLocale` (English pages: en-GB style).
import { dateLocale } from './format';

export type Dated = { startedAt: string; timeZone: string | null };

export type MonthGroup<T> = {
  /** `YYYY-MM` of the local day. */
  key: string;
  items: T[];
};

const zones = new Map<string, boolean>();

/** The zone if this browser's Intl knows it, else `fallback` (undefined = the browser's own zone). */
export function displayZone(timeZone: string | null, fallback?: string): string | undefined {
  if (!timeZone) {
    return fallback;
  }
  let known = zones.get(timeZone);
  if (known === undefined) {
    try {
      new Intl.DateTimeFormat('en', { timeZone });
      known = true;
    } catch {
      known = false;
    }
    zones.set(timeZone, known);
  }
  return known ? timeZone : fallback;
}

/** `YYYY-MM` of the activity's local start day. */
export function monthKey(item: Dated, fallbackZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: displayZone(item.timeZone, fallbackZone),
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(item.startedAt));
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

/**
 * Groups activities (newest first, as the API lists them) by the month of their local start day,
 * newest month first. Order inside a month is kept.
 */
export function groupByMonth<T extends Dated>(items: readonly T[], fallbackZone?: string): MonthGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = monthKey(item, fallbackZone);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, group]) => ({ key, items: group }));
}

/** "October 2026" / "październik 2026" for a `YYYY-MM` key. */
export function monthLabel(locale: string, key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(dateLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 15))
  );
}

/** A list row's day and time in the activity's zone: "Thu 22 Oct, 07:12" / "czw., 22 paź, 07:12". */
export function rowWhen(locale: string, item: Dated, fallbackZone?: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: displayZone(item.timeZone, fallbackZone),
  }).format(new Date(item.startedAt));
}

/**
 * The detail's full date and time in the activity's zone; the zone's short name is added when it
 * isn't the browser's own, or the browser's is unknown (a run abroad reads in the time it was
 * there, and says so).
 */
export function detailWhen(locale: string, item: Dated, browserZone?: string): string {
  const zone = displayZone(item.timeZone, browserZone);
  // Named when it isn't the browser's own, or when the browser's zone is unknown.
  const showZone = zone !== undefined && zone !== browserZone;
  return new Intl.DateTimeFormat(dateLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zone,
    ...(showZone ? { timeZoneName: 'short' as const } : {}),
  }).format(new Date(item.startedAt));
}

/** The browser's own IANA zone (undefined when Intl can't tell). */
export function browserZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
