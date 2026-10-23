import { evaluateAchievements } from '../achievements';
import { summarizeAchievements } from '../achievements-summary';

const at = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();

describe('summarizeAchievements', () => {
  it('starts at 0 of 20 with First steps closest (ties keep display order)', () => {
    const s = summarizeAchievements(evaluateAchievements({ activities: [], turfCells: 0, strongCells: 0 }));
    expect(s).toMatchObject({ unlocked: 0, total: 20 });
    expect(s.closest?.id).toBe('first-steps');
  });

  it('picks the locked achievement with the highest progress ratio', () => {
    const s = summarizeAchievements(
      evaluateAchievements({
        activities: [{ type: 'walk', startedAt: at(14), distanceM: 4000 }],
        turfCells: 90,
        strongCells: 0,
      })
    );
    expect(s.unlocked).toBe(1); // first steps
    expect(s.closest?.id).toBe('neighbourhood'); // 90/100 beats 5K at 4/5
  });

  it('has no closest once everything is unlocked', () => {
    const list = evaluateAchievements({ activities: [], turfCells: 0, strongCells: 0 }).map((a) => ({
      ...a,
      unlocked: true,
    }));
    expect(summarizeAchievements(list)).toEqual({ unlocked: 20, total: 20, closest: null });
  });
});
