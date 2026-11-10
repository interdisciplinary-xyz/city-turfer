import type { Database } from '@/platform/database';
import { appendToOutbox } from '@/platform/outbox';

import { DailyGoal } from '../domain/daily-goal';
import type { GoalRepository } from '../domain/goal-repository';

/** Tables goal_daily_targets and goal_state (migration 15). */
export class SqliteGoalRepository implements GoalRepository {
  constructor(private readonly db: Database) {}

  async get(): Promise<DailyGoal> {
    const [rows, state] = await Promise.all([
      this.db.all<{ effective_from: string; minutes: number; set_at: number }>(
        'SELECT effective_from, minutes, set_at FROM goal_daily_targets ORDER BY effective_from'
      ),
      this.db.first<{ offer_hidden: number }>('SELECT offer_hidden FROM goal_state WHERE id = 1'),
    ]);
    return DailyGoal.rehydrate({
      history: rows.map((r) => ({ effectiveFrom: r.effective_from, minutes: r.minutes, setAt: r.set_at })),
      offerHiddenFlag: (state?.offer_hidden ?? 0) === 1,
    });
  }

  async save(goal: DailyGoal): Promise<void> {
    const s = goal.toState();
    const events = goal.pullEvents();
    const now = events[events.length - 1]?.at ?? Date.now();
    await this.db.transaction(async (tx) => {
      // A handful of rows (one per day the goal changed): write them all, the newest wins per day.
      for (const c of s.history) {
        await tx.run(
          `INSERT INTO goal_daily_targets (effective_from, minutes, set_at) VALUES (?, ?, ?)
           ON CONFLICT(effective_from) DO UPDATE SET minutes = excluded.minutes, set_at = excluded.set_at
           WHERE excluded.set_at >= goal_daily_targets.set_at`,
          [c.effectiveFrom, c.minutes, c.setAt]
        );
      }
      await tx.run(
        `INSERT INTO goal_state (id, offer_hidden) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET offer_hidden = MAX(offer_hidden, excluded.offer_hidden)`,
        [s.offerHiddenFlag ? 1 : 0]
      );
      await appendToOutbox(tx, events, now);
    });
  }
}
