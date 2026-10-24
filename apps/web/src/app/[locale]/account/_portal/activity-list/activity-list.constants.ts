import type { ReactNode } from 'react';

import type { ActivitySummary } from '@/api/schema';

export type ActivityListProps = {
  items: readonly ActivitySummary[];
  locale: string;
  /** The zone for activities without one (the browser's); a parameter so stories and tests pin it. */
  fallbackZone?: string;
};

export type ActivityRowProps = { activity: ActivitySummary; locale: string; fallbackZone?: string };

export type MonthProps = { label: string; children: ReactNode };
