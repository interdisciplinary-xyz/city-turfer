import type { Clock } from '@/shared-kernel';

import type { DailyGoalView } from '../contract';
import { type GoalActivityStart, streakReachesPastWeek } from '../domain/daily-goal';
import { GOAL_WEEK_DAYS } from '../domain/daily-goal.constants';
import type { GoalRepository } from '../domain/goal-repository';
import type { LocalCalendar } from '../domain/local-calendar';

/** Port: Activities that started in [from, to) with their moving time (Activity Log's query). */
export interface GoalActivitySource {
  startsBetween(from: number, to: number): Promise<GoalActivityStart[]>;
}

export interface GoalsDeps {
  goals: GoalRepository;
  activities: GoalActivitySource;
  calendar: LocalCalendar;
  clock: Clock;
  /** After a commit: dispatch the outbox (screens refresh on its change). */
  afterCommit: () => void;
}

/** How many days before the week GetDailyGoal reads at a time while a streak runs on. */
const STREAK_WINDOW_DAYS = 28;

/**
 * The Daily goal today, the last 7 days and the streak before them, from stored Activities (no live
 * recording). Reads the week first; only when the streak can run past it (every day before today
 * met) reads older Activities, 28 days at a time backwards, until a window holds a day that ends the
 * run or the first goal day is reached. So `metBeforeWeek` is exact whenever the streak counts it;
 * when a day of the week was missed it is 0 (nothing older is read).
 */
export class GetDailyGoal {
  constructor(private readonly d: GoalsDeps) {}
  async execute(): Promise<DailyGoalView> {
    const { calendar, activities } = this.d;
    const today = calendar.dayOf(this.d.clock.now());
    const weekFirst = calendar.addDays(today, -(GOAL_WEEK_DAYS - 1));
    const to = calendar.startOf(calendar.addDays(today, 1));
    const goal = await this.d.goals.get();
    let starts = await activities.startsBetween(calendar.startOf(weekFirst), to);
    let view = goal.view(starts, calendar, today);
    const first = goal.firstDay;
    if (first == null || !streakReachesPastWeek(view.week)) {
      return view;
    }
    // Days read before the week; the run goes on while all of them were met.
    let read = 0;
    for (let end = weekFirst; end > first && view.metBeforeWeek === read;) {
      let start = end;
      for (let n = 0; n < STREAK_WINDOW_DAYS && start > first; n++, read++) {
        start = calendar.addDays(start, -1);
      }
      const older = await activities.startsBetween(calendar.startOf(start), calendar.startOf(end));
      starts = [...older, ...starts];
      view = goal.view(starts, calendar, today);
      end = start;
    }
    return view;
  }
}

/** Sets the Daily goal from today on (null: off). DomainError 'goal.minutes-invalid' outside 10–180 / step 5. */
export class SetDailyGoal {
  constructor(private readonly d: GoalsDeps) {}
  async execute(minutes: number | null): Promise<void> {
    const now = this.d.clock.now();
    const goal = await this.d.goals.get();
    if (!goal.set(minutes, this.d.calendar.dayOf(now), now)) {
      return;
    }
    await this.d.goals.save(goal);
    this.d.afterCommit();
  }
}

/** Hides the "Set a daily goal" offer for good (this profile). */
export class HideGoalOffer {
  constructor(private readonly d: GoalsDeps) {}
  async execute(): Promise<void> {
    const goal = await this.d.goals.get();
    if (!goal.hideOffer(this.d.clock.now())) {
      return;
    }
    await this.d.goals.save(goal);
    this.d.afterCommit();
  }
}
