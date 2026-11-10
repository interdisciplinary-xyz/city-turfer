import type { DailyGoal } from './daily-goal';

export interface GoalRepository {
  /** The Turfer's Daily goal (an empty history when never set). */
  get(): Promise<DailyGoal>;
  /** Atomic: history + offer flag + pulled events → outbox, in one transaction. */
  save(goal: DailyGoal): Promise<void>;
}
