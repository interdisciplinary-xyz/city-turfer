// Public API of the Goals context: the Daily goal (minutes of moving time a day, opt-in).
import { GetDailyGoal, type GoalsDeps, HideGoalOffer, SetDailyGoal } from './application/use-cases';

export function createGoalsApi(deps: GoalsDeps) {
  return {
    /** Today and the last 7 days, from stored Activities. */
    view: new GetDailyGoal(deps),
    /** From today on; null turns it off. Rejects with DomainError 'goal.minutes-invalid'. */
    set: new SetDailyGoal(deps),
    hideOffer: new HideGoalOffer(deps),
  };
}
export type GoalsApi = ReturnType<typeof createGoalsApi>;
export type { GoalActivitySource, GoalsDeps } from './application/use-cases';
export type * from './contract';
export { addLiveMovingTime, goalStreak } from './domain/daily-goal';
export { DAILY_GOAL_LIMITS } from './domain/daily-goal.constants';
export type { LocalCalendar } from './domain/local-calendar';
