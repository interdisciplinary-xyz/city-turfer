// Dates and waits as the portal shows them. Formatted in the browser (the pages are static shells
// and the data arrives after load), in the visitor's own time zone.

/** "22 October 2026" / "22 października 2026". */
export function formatDate(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso));
}

/** "22 October 2026 at 14:05" / "22 października 2026 14:05". */
export function formatDateTime(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

export type Wait = { key: 'waitSeconds' | 'waitMinutes' | 'waitHours'; count: number };

/** A `Retry-After` in the largest unit that reads well (`portal.common.wait*` messages). */
export function describeWait(seconds: number): Wait {
  if (seconds < 120) {
    return { key: 'waitSeconds', count: Math.max(1, Math.ceil(seconds)) };
  }
  if (seconds < 2 * 3600) {
    return { key: 'waitMinutes', count: Math.ceil(seconds / 60) };
  }
  return { key: 'waitHours', count: Math.ceil(seconds / 3600) };
}
