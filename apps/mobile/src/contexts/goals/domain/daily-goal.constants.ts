/** The Daily goal's range in minutes: 10–180 in steps of 5, 30 suggested (docs/plans/daily-goal-2026-11-10.md). */
export const DAILY_GOAL_LIMITS = { min: 10, max: 180, step: 5, suggested: 30 } as const;

/** Days in the strip: the last 7 ending today. */
export const GOAL_WEEK_DAYS = 7;
