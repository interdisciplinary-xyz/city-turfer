import type { Clock } from '@/shared-kernel';

import type { DailyGoalView } from '../contract';
import type { GoalActivityStart } from '../domain/daily-goal';
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

/**
 * The Daily goal today, the last 7 days and the streak before them, from stored Activities (no live
 * recording). Reads Activities back to the first day a goal was set, the furthest a streak reaches.
 */
export class GetDailyGoal {
  constructor(private readonly d: GoalsDeps) {}
  async execute(): Promise<DailyGoalView> {
    const { calendar } = this.d;
    const today = calendar.dayOf(this.d.clock.now());
    const weekFrom = calendar.startOf(calendar.addDays(today, -(GOAL_WEEK_DAYS - 1)));
    const to = calendar.startOf(calendar.addDays(today, 1));
    const goal = await this.d.goals.get();
    const first = goal.firstDay;
    const from = first == null ? weekFrom : Math.min(weekFrom, calendar.startOf(first));
    const starts = await this.d.activities.startsBetween(from, to);
    return goal.view(starts, calendar, today);
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
