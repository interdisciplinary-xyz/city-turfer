import type { ActivityType } from '@/api/schema';

/** The list's filter (H6: page state, never in the URL). */
export type HistoryFilter = 'all' | ActivityType;

export const HISTORY_FILTERS: readonly HistoryFilter[] = ['all', 'walk', 'run', 'cycle'];

export type ActivityFilterProps = {
  value: HistoryFilter;
  onChange: (value: HistoryFilter) => void;
};
