// Published language of the Goals context (types only): the Daily goal.
import type { DomainEvent } from '@/shared-kernel';

/** A local calendar day of the device, 'YYYY-MM-DD'. */
export type LocalDay = string;

export interface GoalDay {
  day: LocalDay;
  /** Epoch ms of the day's local midnight. */
  startsAt: number;
  /** The goal in force that day; null: off or never set. */
  goalMinutes: number | null;
  /** Moving time (recorded + estimated) of the Activities that started that day. */
  movingS: number;
  /** movingS ≥ goalMinutes × 60; false without a goal. */
  met: boolean;
}

export interface DailyGoalView {
  goalMinutes: number | null; // in force today; null = off or never set
  offerHidden: boolean;
  today: GoalDay;
  week: GoalDay[]; // 7 days, oldest first, last = today
  /**
   * Goal met on each of this many days in a row, ending the day before `week` starts. 0 when a day
   * of the week before today was missed: the streak can't reach past it, so it isn't read.
   */
  metBeforeWeek: number;
}

/** The Turfer set the Daily goal from `effectiveFrom` on (minutes 0: turned off). Saved with the change. */
export interface DailyGoalSet extends DomainEvent<'DailyGoalSet'> {
  effectiveFrom: LocalDay;
  minutes: number;
}

/** The Turfer hid the "Set a daily goal" offer. Saved with the flag. */
export type DailyGoalOfferHidden = DomainEvent<'DailyGoalOfferHidden'>;
