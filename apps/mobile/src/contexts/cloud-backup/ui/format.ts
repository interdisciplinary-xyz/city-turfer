/** "just now" · "5 min ago" · "today 14:05" · "18 Oct, 09:30": when the last backup run finished. */
export function describeLastRun(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const d = new Date(at);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (new Date(now).toDateString() === d.toDateString()) {
    return `today ${time}`;
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Backed up 12 of 40 activities · last run 5 min ago" — progress in words. */
export function describeProgress(
  s: { backedUp: number; total: number; lastRunAt: number | null },
  now: number
): string {
  const what = s.total === 1 ? 'activity' : 'activities';
  const progress = `Backed up ${s.backedUp} of ${s.total} ${what}`;
  return s.lastRunAt != null ? `${progress} · last run ${describeLastRun(s.lastRunAt, now)}` : progress;
}
