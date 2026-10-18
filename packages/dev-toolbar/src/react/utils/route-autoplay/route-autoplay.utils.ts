import {
  AUTOPLAY_MAX_DWELL_MS,
  AUTOPLAY_MIN_DWELL_MS,
  AUTOPLAY_QUIET_MS,
  type PageSettleInput,
} from './route-autoplay.constants';

/**
 * Whether autoplay may leave the page: it has been open long enough, none
 * of its requests is still in flight, and nothing started or finished
 * recently. Past the max dwell it may leave regardless.
 */
export function isPageSettled({ entries, page, loadedAt, now }: PageSettleInput): boolean {
  const open = now - loadedAt;
  if (open >= AUTOPLAY_MAX_DWELL_MS) {
    return true;
  }
  if (open < AUTOPLAY_MIN_DWELL_MS) {
    return false;
  }

  let lastActivity = loadedAt;
  for (const entry of entries) {
    if (entry.page !== page || entry.startedAt < loadedAt) {
      continue;
    }
    if (entry.status === 'pending') {
      return false;
    }
    lastActivity = Math.max(lastActivity, entry.startedAt + (entry.durationMs ?? 0));
  }
  return now - lastActivity >= AUTOPLAY_QUIET_MS;
}
