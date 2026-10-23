import type { T } from '@/i18n';
import { currentDateLocale } from '@/i18n/language-state';

import type { RestoreOffer, RestoreProgress, RestoreResult } from '../application/restore';

/*
 * Cloud backup and restore copy as pure functions of the `backup` messages: components pass
 * `useT('backup')` (so they re-render on a language change), tests `translator('backup', locale)`.
 */

const formats = new Map<string, Intl.DateTimeFormat>();
const dateFormat = (locale: string, withDay: boolean) => {
  const key = `${withDay ? 'day' : 'time'}|${locale}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(
      locale,
      withDay
        ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' }
    );
    formats.set(key, f);
  }
  return f;
};

/**
 * "just now" · "5 min ago" · "today 14:05" · "18 Oct, 09:30" (en-GB; "18 paź, 09:30" in Polish):
 * when the last backup run finished. Times and dates come from Intl in `locale` (the app language).
 */
export function describeLastRun(at: number, now: number, t: T<'backup'>, locale: string = currentDateLocale()): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) {
    return t('lastRun.justNow');
  }
  if (minutes < 60) {
    return t('lastRun.minutesAgo', { count: minutes });
  }
  const d = new Date(at);
  if (new Date(now).toDateString() === d.toDateString()) {
    return t('lastRun.today', { time: dateFormat(locale, false).format(d) });
  }
  return dateFormat(locale, true).format(d);
}

/** "Backed up 12 of 40 activities · last run 5 min ago": progress in words. */
export function describeProgress(
  s: { backedUp: number; total: number; lastRunAt: number | null },
  now: number,
  t: T<'backup'>,
  locale: string = currentDateLocale()
): string {
  const values = { backedUp: s.backedUp, total: s.total };
  return s.lastRunAt != null
    ? t('progressLastRun', { ...values, lastRun: describeLastRun(s.lastRunAt, now, t, locale) })
    : t('progress', values);
}

/** "2 activities can't be backed up (too long or unreadable)." */
export const describeRefused = (n: number, t: T<'backup'>): string => t('refused', { count: n });

/** "Your backup holds 42 activities that aren't on this phone. …" */
export function describeOffer(offer: Extract<RestoreOffer, { kind: 'available' | 'resume' }>, t: T<'backup'>): string {
  return offer.kind === 'resume'
    ? t('restore.resume', { done: offer.done, total: offer.total })
    : t('restore.offer', { count: offer.count });
}

/** "Restoring 3 of 40…" while a restore runs. */
export function describeRestoreProgress(p: RestoreProgress | null, t: T<'backup'>): string {
  return p && p.total > 0
    ? t('restore.progress', { current: Math.min(p.done + 1, p.total), total: p.total })
    : t('restore.running');
}

/**
 * What the result means, in plain words (null: nothing to say). `health`: Apple Health is possible on
 * this phone (iOS), so mention that it was left off.
 */
export function describeRestoreResult(
  r: RestoreResult | null,
  t: T<'backup'>,
  { health = false }: { health?: boolean } = {}
): string | null {
  if (!r) {
    return null;
  }
  switch (r.kind) {
    case 'done': {
      const what =
        r.skipped > 0
          ? t('restore.restoredSkipped', { restored: r.restored, skipped: r.skipped })
          : r.restored === 0
            ? t('restore.nothingToRestore')
            : t('restore.restored', { count: r.restored });
      // Two sentences side by side (each whole), not a spliced phrase.
      return health && r.healthOffered ? `${what} ${t('restore.healthOff')}` : what;
    }
    case 'paused':
      return t(`paused.${r.reason}`);
    default:
      return r.reason === 'no-token' ? t('restore.signInFirst') : null;
  }
}
