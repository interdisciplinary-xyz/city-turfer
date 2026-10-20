import type { Achievement } from './achievements';

export interface AchievementsSummary {
  unlocked: number;
  total: number;
  /** The locked achievement nearest to done (highest current/target; ties keep display order), or null when all are unlocked. */
  closest: Achievement | null;
}

export function summarizeAchievements(list: readonly Achievement[]): AchievementsSummary {
  let closest: Achievement | null = null;
  for (const a of list) {
    if (a.unlocked) {
      continue;
    }
    if (!closest || a.current / a.target > closest.current / closest.target) {
      closest = a;
    }
  }
  return { unlocked: list.filter((a) => a.unlocked).length, total: list.length, closest };
}
