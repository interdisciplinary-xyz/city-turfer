import type { ActivityTotals } from '@/api/schema';

export type ActivityTotalsProps = { totals: ActivityTotals; locale: string };

/** The tiles in order: everything, then each type (a type with nothing backed up is left out). */
export const TOTALS_ORDER = ['all', 'walk', 'run', 'cycle'] as const;

export type TotalsKey = (typeof TOTALS_ORDER)[number];

export function totalsTiles(totals: ActivityTotals) {
  return TOTALS_ORDER.map((key) => ({ key, totals: key === 'all' ? totals.allTime : totals.byType[key] })).filter(
    (tile) => tile.key === 'all' || tile.totals.count > 0
  );
}
