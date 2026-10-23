import { type ActivityType, weekStartOf } from '../../../shared-kernel';

/** What achievements are judged on: published facts from Activity Log and Territory. */
export interface AchievementInput {
  activities: readonly { type: ActivityType; startedAt: number; distanceM: number }[];
  turfCells: number;
  strongCells: number;
}

/** Ids are stable: unlocks are computed live from history, so an id may be added but never reused. */
export type AchievementId =
  | 'first-steps'
  | 'all-rounder'
  | 'early-bird'
  | 'night-owl'
  | 'neighbourhood'
  | 'district'
  | 'turf-lord'
  | 'across-town'
  | 'first-glow'
  | 'stronghold'
  | 'home-ground'
  | 'regular'
  | 'four-weeks'
  | 'season-ticket'
  | 'five-k'
  | 'ten-k'
  | 'half-marathon'
  | 'half-century-ride'
  | 'hundred-km'
  | 'five-hundred-km';

/**
 * Display groups, in display order. Turf (new streets) and glow (coming back) come before distance:
 * the map is the reward. Habits count different weeks, never weeks in a row, so nothing can be lost.
 */
export const ACHIEVEMENT_GROUPS = ['firsts', 'turf', 'glow', 'habits', 'distance'] as const;
export type AchievementGroup = (typeof ACHIEVEMENT_GROUPS)[number];

export interface Achievement {
  id: AchievementId;
  group: AchievementGroup;
  title: string;
  description: string;
  current: number; // capped at target
  target: number;
  unit: 'km' | 'cells' | 'activities' | 'types' | 'weeks' | null;
  unlocked: boolean;
}

const HALF_MARATHON_M = 21_097.5;

const maxDistanceM = (acts: AchievementInput['activities'], types: readonly ActivityType[]) =>
  Math.max(0, ...acts.filter((a) => types.includes(a.type)).map((a) => a.distanceM));

/** Activities per calendar week (Monday start), keyed by the week's start. */
function perWeek(acts: AchievementInput['activities']): Map<number, number> {
  const weeks = new Map<number, number>();
  for (const a of acts) {
    const w = weekStartOf(a.startedAt);
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  return weeks;
}

const startedWhen = (acts: AchievementInput['activities'], test: (hour: number) => boolean) =>
  acts.some((a) => test(new Date(a.startedAt).getHours())) ? 1 : 0;

/** Every achievement with progress, in display order (grouped). Pure: same input → same list. */
export function evaluateAchievements(input: AchievementInput): Achievement[] {
  const acts = input.activities;
  const km = (m: number) => Math.floor((m / 1000) * 10) / 10;
  const weeks = perWeek(acts);
  const busiestWeek = Math.max(0, ...weeks.values());
  const longest = km(maxDistanceM(acts, ['walk', 'run', 'cycle']));
  const totalKm = km(acts.reduce((m, a) => m + a.distanceM, 0));
  const rows: Omit<Achievement, 'unlocked'>[] = [
    {
      id: 'first-steps',
      group: 'firsts',
      title: 'First steps',
      description: 'Record your first activity.',
      current: acts.length,
      target: 1,
      unit: 'activities',
    },
    {
      id: 'all-rounder',
      group: 'firsts',
      title: 'All-rounder',
      description: 'Walk, run and ride at least once each.',
      current: new Set(acts.map((a) => a.type)).size,
      target: 3,
      unit: 'types',
    },
    {
      id: 'early-bird',
      group: 'firsts',
      title: 'Early bird',
      description: 'Start an activity before 7:00.',
      current: startedWhen(acts, (h) => h < 7),
      target: 1,
      unit: null,
    },
    {
      id: 'night-owl',
      group: 'firsts',
      title: 'Night owl',
      description: 'Start an activity after 22:00.',
      current: startedWhen(acts, (h) => h >= 22),
      target: 1,
      unit: null,
    },
    {
      id: 'neighbourhood',
      group: 'turf',
      title: 'Neighbourhood',
      description: 'Own 100 turf cells.',
      current: input.turfCells,
      target: 100,
      unit: 'cells',
    },
    {
      id: 'district',
      group: 'turf',
      title: 'District',
      description: 'Own 500 turf cells.',
      current: input.turfCells,
      target: 500,
      unit: 'cells',
    },
    {
      id: 'turf-lord',
      group: 'turf',
      title: 'Turf lord',
      description: 'Own 1,000 turf cells.',
      current: input.turfCells,
      target: 1000,
      unit: 'cells',
    },
    {
      id: 'across-town',
      group: 'turf',
      title: 'Across town',
      description: 'Own 5,000 turf cells.',
      current: input.turfCells,
      target: 5000,
      unit: 'cells',
    },
    {
      id: 'first-glow',
      group: 'glow',
      title: 'First glow',
      description: 'Come back to a street until one of its cells turns strong.',
      current: input.strongCells,
      target: 1,
      unit: 'cells',
    },
    {
      id: 'stronghold',
      group: 'glow',
      title: 'Stronghold',
      description: 'Make 50 cells strong by coming back again and again.',
      current: input.strongCells,
      target: 50,
      unit: 'cells',
    },
    {
      id: 'home-ground',
      group: 'glow',
      title: 'Home ground',
      description: 'Make 250 cells strong. These streets are yours.',
      current: input.strongCells,
      target: 250,
      unit: 'cells',
    },
    {
      id: 'regular',
      group: 'habits',
      title: 'Regular',
      description: 'Record 3 activities in one week.',
      current: busiestWeek,
      target: 3,
      unit: 'activities',
    },
    {
      id: 'four-weeks',
      group: 'habits',
      title: 'Four weeks out',
      description: 'Get out in 4 different weeks. Any weeks: there is no streak to keep.',
      current: weeks.size,
      target: 4,
      unit: 'weeks',
    },
    {
      id: 'season-ticket',
      group: 'habits',
      title: 'Season ticket',
      description: 'Get out in 12 different weeks.',
      current: weeks.size,
      target: 12,
      unit: 'weeks',
    },
    {
      id: 'five-k',
      group: 'distance',
      title: '5K',
      description: 'Cover 5 km in a single activity.',
      current: longest,
      target: 5,
      unit: 'km',
    },
    {
      id: 'ten-k',
      group: 'distance',
      title: '10K',
      description: 'Cover 10 km in a single activity.',
      current: longest,
      target: 10,
      unit: 'km',
    },
    {
      id: 'half-marathon',
      group: 'distance',
      title: 'Half marathon',
      description: 'Walk or run 21.1 km in one go.',
      current: km(maxDistanceM(acts, ['walk', 'run'])),
      target: 21.1,
      unit: 'km',
    },
    {
      id: 'half-century-ride',
      group: 'distance',
      title: 'Half century',
      description: 'Ride 50 km in one go.',
      current: km(maxDistanceM(acts, ['cycle'])),
      target: 50,
      unit: 'km',
    },
    {
      id: 'hundred-km',
      group: 'distance',
      title: '100 km club',
      description: 'Cover 100 km in total.',
      current: totalKm,
      target: 100,
      unit: 'km',
    },
    {
      id: 'five-hundred-km',
      group: 'distance',
      title: '500 km club',
      description: 'Cover 500 km in total.',
      current: totalKm,
      target: 500,
      unit: 'km',
    },
  ];
  // Single-activity distances are checked against the exact half-marathon distance, not the rounded label.
  return rows.map((r) => {
    const unlocked =
      r.id === 'half-marathon' ? maxDistanceM(acts, ['walk', 'run']) >= HALF_MARATHON_M : r.current >= r.target;
    return { ...r, current: Math.min(r.current, r.target), unlocked };
  });
}
