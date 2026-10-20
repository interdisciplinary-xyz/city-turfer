import { type ActivityType, weekStartOf } from '../../../shared-kernel';

/** What achievements are judged on: published facts from Activity Log and Territory. */
export interface AchievementInput {
  activities: readonly { type: ActivityType; startedAt: number; distanceM: number }[];
  turfCells: number;
  strongCells: number;
}

export type AchievementId =
  | 'first-steps'
  | 'all-rounder'
  | 'five-k'
  | 'half-marathon'
  | 'half-century-ride'
  | 'hundred-km'
  | 'regular'
  | 'early-bird'
  | 'night-owl'
  | 'neighbourhood'
  | 'turf-lord'
  | 'stronghold';

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  current: number; // capped at target
  target: number;
  unit: 'km' | 'cells' | 'activities' | 'types' | null;
  unlocked: boolean;
}

const HALF_MARATHON_M = 21_097.5;

const maxDistanceM = (acts: AchievementInput['activities'], types: readonly ActivityType[]) =>
  Math.max(0, ...acts.filter((a) => types.includes(a.type)).map((a) => a.distanceM));

function maxPerWeek(acts: AchievementInput['activities']): number {
  const weeks = new Map<number, number>();
  for (const a of acts) {
    const w = weekStartOf(a.startedAt);
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  return Math.max(0, ...weeks.values());
}

const startedWhen = (acts: AchievementInput['activities'], test: (hour: number) => boolean) =>
  acts.some((a) => test(new Date(a.startedAt).getHours())) ? 1 : 0;

/** Every achievement with progress, in display order. Pure: same input → same list. */
export function evaluateAchievements(input: AchievementInput): Achievement[] {
  const acts = input.activities;
  const km = (m: number) => Math.floor((m / 1000) * 10) / 10;
  const rows: Omit<Achievement, 'unlocked'>[] = [
    {
      id: 'first-steps',
      title: 'First steps',
      description: 'Record your first activity.',
      current: acts.length,
      target: 1,
      unit: 'activities',
    },
    {
      id: 'all-rounder',
      title: 'All-rounder',
      description: 'Walk, run and ride at least once each.',
      current: new Set(acts.map((a) => a.type)).size,
      target: 3,
      unit: 'types',
    },
    {
      id: 'five-k',
      title: '5K',
      description: 'Cover 5 km in a single activity.',
      current: km(maxDistanceM(acts, ['walk', 'run', 'cycle'])),
      target: 5,
      unit: 'km',
    },
    {
      id: 'half-marathon',
      title: 'Half marathon',
      description: 'Walk or run 21.1 km in one go.',
      current: km(maxDistanceM(acts, ['walk', 'run'])),
      target: 21.1,
      unit: 'km',
    },
    {
      id: 'half-century-ride',
      title: 'Half century',
      description: 'Ride 50 km in one go.',
      current: km(maxDistanceM(acts, ['cycle'])),
      target: 50,
      unit: 'km',
    },
    {
      id: 'hundred-km',
      title: '100 km club',
      description: 'Cover 100 km in total.',
      current: km(acts.reduce((m, a) => m + a.distanceM, 0)),
      target: 100,
      unit: 'km',
    },
    {
      id: 'regular',
      title: 'Regular',
      description: 'Record 3 activities in one week.',
      current: maxPerWeek(acts),
      target: 3,
      unit: 'activities',
    },
    {
      id: 'early-bird',
      title: 'Early bird',
      description: 'Start an activity before 7:00.',
      current: startedWhen(acts, (h) => h < 7),
      target: 1,
      unit: null,
    },
    {
      id: 'night-owl',
      title: 'Night owl',
      description: 'Start an activity after 22:00.',
      current: startedWhen(acts, (h) => h >= 22),
      target: 1,
      unit: null,
    },
    {
      id: 'neighbourhood',
      title: 'Neighbourhood',
      description: 'Own 100 turf cells.',
      current: input.turfCells,
      target: 100,
      unit: 'cells',
    },
    {
      id: 'turf-lord',
      title: 'Turf lord',
      description: 'Own 1,000 turf cells.',
      current: input.turfCells,
      target: 1000,
      unit: 'cells',
    },
    {
      id: 'stronghold',
      title: 'Stronghold',
      description: 'Make 50 cells strong by coming back again and again.',
      current: input.strongCells,
      target: 50,
      unit: 'cells',
    },
  ];
  // Single-activity distances are checked against the exact half-marathon distance, not the rounded label.
  return rows.map((r) => {
    const unlocked =
      r.id === 'half-marathon' ? maxDistanceM(acts, ['walk', 'run']) >= HALF_MARATHON_M : r.current >= r.target;
    return { ...r, current: Math.min(r.current, r.target), unlocked };
  });
}
