import { activityNameProblem } from '@cityturfer/core/activity-log';

import { describeLength, NAME_PROBLEM_TEXT } from '../rename-activity-dialog.constants';

describe('rename form copy', () => {
  it('names every problem the domain can report, and counts trimmed characters', () => {
    expect(NAME_PROBLEM_TEXT[activityNameProblem('  ')!]).toBe('Give it a name.');
    expect(NAME_PROBLEM_TEXT[activityNameProblem('x'.repeat(81))!]).toBe('Keep it to 80 characters.');
    expect(describeLength('  Hill repeats ')).toBe('12/80');
  });
});
