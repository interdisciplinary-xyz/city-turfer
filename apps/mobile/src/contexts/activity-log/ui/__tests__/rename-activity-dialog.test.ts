import { ACTIVITY_NAME_MAX_LENGTH, activityNameProblem } from '@cityturfer/core/activity-log';

import { translator } from '@/i18n/translator';

import { describeLength, NAME_PROBLEM_KEY } from '../rename-activity-dialog.constants';

describe('rename form copy', () => {
  const problem = (name: string, locale: 'en' | 'pl') =>
    translator('activity', locale)(NAME_PROBLEM_KEY[activityNameProblem(name)!], { max: ACTIVITY_NAME_MAX_LENGTH });

  it('names every problem the domain can report, and counts trimmed characters', () => {
    expect(problem('  ', 'en')).toBe('Give it a name.');
    expect(problem('x'.repeat(81), 'en')).toBe('Keep it to 80 characters.');
    expect(describeLength('  Hill repeats ')).toBe('12/80');
  });

  it('says it in Polish too', () => {
    expect(problem('  ', 'pl')).toBe('Nadaj jej nazwę.');
    expect(problem('x'.repeat(81), 'pl')).toBe('Maksymalnie 80 znaków.');
  });
});
