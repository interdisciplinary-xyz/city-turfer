import { DomainError } from '@/shared-kernel';

import type { DailyGoalOfferHidden, DailyGoalSet, DailyGoalView, GoalDay, LocalDay } from '../contract';
import { DAILY_GOAL_LIMITS, GOAL_WEEK_DAYS } from './daily-goal.constants';
import { isLocalDay, type LocalCalendar } from './local-calendar';

/** A Daily goal in minutes: 10–180 in steps of 5. */
export class DailyGoalMinutes {
  private constructor(readonly minutes: number) {}
  static of(minutes: number): DailyGoalMinutes {
    const { min, max, step } = DAILY_GOAL_LIMITS;
    if (!Number.isInteger(minutes) || minutes < min || minutes > max || (minutes - min) % step !== 0) {
      throw new DomainError('goal.minutes-invalid', `${minutes}`);
    }
    return new DailyGoalMinutes(minutes);
  }
}

/** One row of the goal's history: from `effectiveFrom` on, the goal is `minutes` (0: off). */
export interface GoalChange {
  effectiveFrom: LocalDay;
  minutes: number;
  /** Epoch ms of the change (the latest wins within a day). */
  setAt: number;
}

/** What moving time counts: an Activity's start and its moving seconds (recorded + estimated). */
export interface GoalActivityStart {
  startedAt: number;
  movingS: number;
}

export type GoalEvent = DailyGoalSet | DailyGoalOfferHidden;

export interface DailyGoalState {
  history: GoalChange[];
  offerHiddenFlag: boolean;
}

const byDay = (a: GoalChange, b: GoalChange) =>
  a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : a.setAt - b.setAt;

/** The goal in force on `day` (null: off or never set): the latest change made on or before it. */
export function goalOn(day: LocalDay, history: readonly GoalChange[]): number | null {
  let inForce: GoalChange | null = null;
  for (const c of [...history].sort(byDay)) {
    if (c.effectiveFrom > day) {
      break;
    }
    inForce = c;
  }
  return inForce && inForce.minutes > 0 ? inForce.minutes : null;
}

const goalDay = (day: LocalDay, startsAt: number, goalMinutes: number | null, movingS: number): GoalDay => ({
  day,
  startsAt,
  goalMinutes,
  movingS,
  met: goalMinutes != null && movingS >= goalMinutes * 60,
});

/**
 * The last 7 days ending `today`, oldest first. An Activity counts in full on the local day it
 * started (a 23:40–00:20 walk counts for the first day); each day is judged by the goal in force then.
 */
export function goalDays(
  starts: readonly GoalActivityStart[],
  history: readonly GoalChange[],
  calendar: LocalCalendar,
  today: LocalDay
): GoalDay[] {
  const moving = movingByDay(starts, calendar);
  return Array.from({ length: GOAL_WEEK_DAYS }, (_, i) => {
    const day = calendar.addDays(today, i - (GOAL_WEEK_DAYS - 1));
    return goalDay(day, calendar.startOf(day), goalOn(day, history), moving.get(day) ?? 0);
  });
}

/** Moving seconds per local day the Activities started on. */
function movingByDay(starts: readonly GoalActivityStart[], calendar: LocalCalendar): Map<LocalDay, number> {
  const moving = new Map<LocalDay, number>();
  for (const s of starts) {
    const day = calendar.dayOf(s.startedAt);
    moving.set(day, (moving.get(day) ?? 0) + Math.max(0, s.movingS));
  }
  return moving;
}

/**
 * Days in a row the goal was met, ending the day before `firstShown` (the week's first day). A day
 * with the goal off or never set ends the run.
 */
export function metDaysBefore(
  firstShown: LocalDay,
  starts: readonly GoalActivityStart[],
  history: readonly GoalChange[],
  calendar: LocalCalendar
): number {
  const moving = movingByDay(starts, calendar);
  let count = 0;
  for (let day = calendar.addDays(firstShown, -1); ; day = calendar.addDays(day, -1)) {
    const goal = goalOn(day, history);
    if (goal == null || (moving.get(day) ?? 0) < goal * 60) {
      return count;
    }
    count += 1;
  }
}

/**
 * The streak: days in a row the goal was met, up to today. Today joins it once met; until then a
 * run ending yesterday still stands (the day isn't over).
 */
export function goalStreak(view: DailyGoalView): number {
  let i = view.week.length - 1;
  if (!view.week[i]?.met) {
    i -= 1;
  }
  let count = 0;
  while (i >= 0 && view.week[i].met) {
    count += 1;
    i -= 1;
  }
  return i < 0 ? count + view.metBeforeWeek : count;
}

/**
 * Whether the streak can run past the week shown: every day of the week before today was met
 * (today may still be unmet). Only then does `metBeforeWeek` count, so only then must a reader
 * look at Activities older than the week.
 */
export function streakReachesPastWeek(week: readonly GoalDay[]): boolean {
  return week.slice(0, -1).every((d) => d.met);
}

/**
 * Adds a live recording's moving time (shown on screen, never stored) to the day the recording
 * started, as a stored Activity counts: a walk started at 23:40 and still running after midnight
 * adds to yesterday, not today. A start before the week shown changes nothing.
 */
export function addLiveMovingTime(view: DailyGoalView, movingS: number, startedAt: number): DailyGoalView {
  const extra = Number.isFinite(movingS) && movingS > 0 ? movingS : 0;
  const target = [...view.week].reverse().find((d) => d.startsAt <= startedAt);
  if (extra === 0 || !target) {
    return view;
  }
  const updated = goalDay(target.day, target.startsAt, target.goalMinutes, target.movingS + extra);
  const week = view.week.map((d) => (d.day === updated.day ? updated : d));
  const today = view.today.day === updated.day ? updated : view.today;
  return { ...view, today, week };
}

/**
 * Aggregate: the Turfer's Daily goal, its history of changes (one per local day) and whether the
 * offer to set one was hidden.
 */
export class DailyGoal {
  private events: GoalEvent[] = [];
  private constructor(private state: DailyGoalState) {}

  static rehydrate(state: DailyGoalState): DailyGoal {
    return new DailyGoal({ history: [...state.history].sort(byDay), offerHiddenFlag: state.offerHiddenFlag });
  }

  goalOn(day: LocalDay): number | null {
    return goalOn(day, this.state.history);
  }

  /** The first day a goal was ever in force (null: never set): how far back a streak can reach. */
  get firstDay(): LocalDay | null {
    return this.state.history[0]?.effectiveFrom ?? null;
  }

  /** The offer stays hidden once hidden, and once a goal was ever set (also when turned off later). */
  get offerHidden(): boolean {
    return this.state.offerHiddenFlag || this.state.history.length > 0;
  }

  /** Days up to today judged by the goal in force then; see goalDays. */
  view(starts: readonly GoalActivityStart[], calendar: LocalCalendar, today: LocalDay): DailyGoalView {
    const week = goalDays(starts, this.state.history, calendar, today);
    const todayView = week[week.length - 1];
    const metBeforeWeek = metDaysBefore(week[0].day, starts, this.state.history, calendar);
    return { goalMinutes: todayView.goalMinutes, offerHidden: this.offerHidden, today: todayView, week, metBeforeWeek };
  }

  /**
   * Sets the goal from `today` on (null: off). Past days keep the goal in force then; a second
   * change on the same day replaces the first. Returns false when nothing changed.
   */
  set(minutes: number | null, today: LocalDay, now: number): boolean {
    if (!isLocalDay(today)) {
      throw new DomainError('goal.day-invalid', today);
    }
    const next = minutes == null ? 0 : DailyGoalMinutes.of(minutes).minutes;
    if ((this.goalOn(today) ?? 0) === next) {
      return false;
    }
    const change: GoalChange = { effectiveFrom: today, minutes: next, setAt: now };
    this.state = {
      ...this.state,
      history: [...this.state.history.filter((c) => c.effectiveFrom !== today), change].sort(byDay),
    };
    this.record({ type: 'DailyGoalSet', v: 1, at: now, effectiveFrom: today, minutes: next });
    return true;
  }

  /** Hides the "Set a daily goal" offer. Returns false when it already was. */
  hideOffer(now: number): boolean {
    if (this.state.offerHiddenFlag) {
      return false;
    }
    this.state = { ...this.state, offerHiddenFlag: true };
    this.record({ type: 'DailyGoalOfferHidden', v: 1, at: now });
    return true;
  }

  pullEvents(): GoalEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Repository only. */
  toState(): Readonly<DailyGoalState> {
    return this.state;
  }

  private record(e: GoalEvent) {
    this.events.push(e);
  }
}
