// An activity's numbers exactly as the app shows them (docs/plans/web-portal-history-2026-10-23.md,
// H4): core's formatters with the page's language. Distance is `distanceM` (street estimates over
// GPS gaps included, marked "≈" like the app's list), moving time `movingS`, pace or speed from
// those two. Never re-implement a formatter here.
import {
  type ActivityType,
  distanceText,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  type FormattedQuantity,
} from '@cityturfer/core/shared-kernel';

export type ActivityFigures = {
  type: ActivityType;
  distanceM: number;
  estimatedDistanceM: number;
  movingS: number;
  elapsedS: number;
  elevationGainM: number | null;
};

export type ActivityNumbers = {
  distance: FormattedQuantity;
  /** Part of the distance estimated along streets; true shows "≈" and the note. */
  estimated: boolean;
  estimatedText: string;
  moving: string;
  elapsed: string;
  pace: FormattedQuantity;
  /** "+24" (unit m), or null when the track had no altitude. */
  elevation: string | null;
};

export function activityNumbers(a: ActivityFigures, locale: string): ActivityNumbers {
  return {
    distance: formatDistance(a.distanceM, locale),
    estimated: a.estimatedDistanceM > 0,
    estimatedText: distanceText(a.estimatedDistanceM, locale),
    moving: formatDuration(a.movingS),
    elapsed: formatDuration(a.elapsedS),
    pace: formatPaceOrSpeed(a.type, a.distanceM, a.movingS, locale),
    elevation: a.elevationGainM !== null ? `+${a.elevationGainM}` : null,
  };
}

/** One kilometre split as the app shows it: pace for walks and runs, speed for rides. */
export function splitPace(type: ActivityType, movingS: number, locale: string): FormattedQuantity {
  return formatPaceOrSpeed(type, 1000, movingS, locale);
}

/** A totals tile: distance and moving time, both from core. */
export function totalsNumbers(t: { distanceM: number; movingS: number }, locale: string) {
  return { distance: formatDistance(t.distanceM, locale), moving: formatDuration(t.movingS) };
}
