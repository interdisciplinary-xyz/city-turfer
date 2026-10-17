import { evaluateOnboarding, type OnboardingFacts } from '../onboarding';

const at = (d: number) => new Date(2026, 9, d, 12).getTime();
const empty: OnboardingFacts = { activities: [], turfCells: 0, strongCells: 0, achievementsUnlocked: 0 };
const doneIds = (f: OnboardingFacts) =>
  evaluateOnboarding(f)
    .steps.filter((s) => s.done)
    .map((s) => s.id);

describe('evaluateOnboarding', () => {
  it('starts at 0 of 5, incomplete', () => {
    expect(evaluateOnboarding(empty)).toMatchObject({ done: 0, total: 5, complete: false });
  });

  it('keeps a stable step order', () => {
    expect(evaluateOnboarding(empty).steps.map((s) => s.id)).toEqual([
      'first-walk',
      'see-turf',
      'try-all-three',
      'come-back',
      'unlock-three',
    ]);
  });

  it('first activity and turf cells tick the first two steps', () => {
    const f: OnboardingFacts = { ...empty, activities: [{ type: 'walk', startedAt: at(1) }], turfCells: 4 };
    expect(doneIds(f)).toEqual(['first-walk', 'see-turf']);
    expect(evaluateOnboarding(f)).toMatchObject({ done: 2, total: 5 });
  });

  it('needs all three types for step 3', () => {
    const two: OnboardingFacts['activities'] = [
      { type: 'walk', startedAt: at(1) },
      { type: 'run', startedAt: at(1) },
    ];
    expect(doneIds({ ...empty, activities: two })).not.toContain('try-all-three');
    expect(doneIds({ ...empty, activities: [...two, { type: 'cycle', startedAt: at(1) }] })).toContain('try-all-three');
  });

  it('come back: a strong cell, or activities on two different days (not the same day)', () => {
    const sameDay: OnboardingFacts['activities'] = [
      { type: 'walk', startedAt: at(1) },
      { type: 'walk', startedAt: at(1) + 3600_000 },
    ];
    expect(doneIds({ ...empty, activities: sameDay })).not.toContain('come-back');
    expect(doneIds({ ...empty, activities: [...sameDay, { type: 'walk', startedAt: at(2) }] })).toContain('come-back');
    expect(doneIds({ ...empty, strongCells: 1 })).toContain('come-back');
  });

  it('is complete when every step is done', () => {
    const r = evaluateOnboarding({
      activities: [
        { type: 'walk', startedAt: at(1) },
        { type: 'run', startedAt: at(2) },
        { type: 'cycle', startedAt: at(3) },
      ],
      turfCells: 10,
      strongCells: 1,
      achievementsUnlocked: 3,
    });
    expect(r).toMatchObject({ done: 5, total: 5, complete: true });
  });
});
