import { type Achievement, evaluateAchievements } from '@cityturfer/core/achievements';

import { translator } from '@/i18n/translator';

import { achievementCopy } from '../achievement-copy';
import { ACHIEVEMENT_KEY } from '../achievement-copy.constants';

const list = evaluateAchievements({
  activities: [{ type: 'run', startedAt: new Date(2026, 9, 20, 12).getTime(), distanceM: 3450 }],
  turfCells: 523,
  strongCells: 4,
});
const byId = (id: Achievement['id']) => list.find((a) => a.id === id)!;

describe('achievementCopy', () => {
  it('keeps the English text core has (the API fallback) for every achievement', () => {
    const t = translator('achievements', 'en');
    for (const a of list) {
      const copy = achievementCopy(a, t, 'en');
      expect([copy.title, copy.description]).toEqual([a.title, a.description]);
    }
    expect(Object.keys(ACHIEVEMENT_KEY)).toHaveLength(list.length);
  });

  it('writes progress with plural units, km with a decimal', () => {
    const en = translator('achievements', 'en');
    const pl = translator('achievements', 'pl');
    expect(achievementCopy(byId('first-steps'), en, 'en').progress).toBe('Unlocked');
    expect(achievementCopy(byId('five-k'), en, 'en').progress).toBe('3.4 / 5 km');
    expect(achievementCopy(byId('five-k'), pl, 'pl').progress).toBe('3,4 / 5 km');
    expect(achievementCopy(byId('turf-lord'), en, 'en').progress).toBe('523 / 1000 cells');
    expect(achievementCopy(byId('turf-lord'), pl, 'pl').progress).toBe('523 / 1000 komórek');
    expect(achievementCopy(byId('all-rounder'), en, 'en').progress).toBe('1 / 3 types');
    expect(achievementCopy(byId('all-rounder'), pl, 'pl').progress).toBe('1 / 3 rodzaje');
    expect(achievementCopy(byId('regular'), pl, 'pl').progress).toBe('1 / 3 aktywności');
    expect(achievementCopy(byId('early-bird'), pl, 'pl').progress).toBe('Jeszcze nie');
  });
});
