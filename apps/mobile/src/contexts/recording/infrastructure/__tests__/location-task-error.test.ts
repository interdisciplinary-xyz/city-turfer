import { isExpectedLocationTaskError } from '../location-task-error';

describe('isExpectedLocationTaskError', () => {
  it('treats location unknown (0) and denied (1) as expected', () => {
    expect(isExpectedLocationTaskError(0)).toBe(true);
    expect(isExpectedLocationTaskError(1)).toBe(true);
    expect(isExpectedLocationTaskError('1')).toBe(true);
  });

  it('reports every other code', () => {
    expect(isExpectedLocationTaskError(2)).toBe(false);
    expect(isExpectedLocationTaskError(undefined)).toBe(false);
    expect(isExpectedLocationTaskError('E_TASK')).toBe(false);
  });
});
