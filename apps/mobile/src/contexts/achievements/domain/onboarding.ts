import type { ActivityType } from '@/shared-kernel';

/** What the Getting started checklist is judged on: published facts, never stored state. */
export interface OnboardingFacts {
  activities: readonly { type: ActivityType; startedAt: number }[];
  turfCells: number;
  strongCells: number;
  achievementsUnlocked: number;
}

export type OnboardingStepId = 'first-walk' | 'see-turf' | 'try-all-three' | 'come-back' | 'unlock-three';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  done: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  done: number;
  total: number;
  complete: boolean;
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Steps in display order with their done flags. Pure: same facts give the same checklist. */
export function evaluateOnboarding(facts: OnboardingFacts): OnboardingProgress {
  const types = new Set(facts.activities.map((a) => a.type));
  const days = new Set(facts.activities.map((a) => dayKey(a.startedAt)));
  const steps: OnboardingStep[] = [
    { id: 'first-walk', title: 'Record your first walk', done: facts.activities.length >= 1 },
    { id: 'see-turf', title: 'See your turf on the map', done: facts.turfCells >= 1 },
    { id: 'try-all-three', title: 'Walk, run and ride', done: types.size >= 3 },
    { id: 'come-back', title: 'Come back to a street', done: facts.strongCells >= 1 || days.size >= 2 },
    { id: 'unlock-three', title: 'Unlock 3 achievements', done: facts.achievementsUnlocked >= 3 },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}
