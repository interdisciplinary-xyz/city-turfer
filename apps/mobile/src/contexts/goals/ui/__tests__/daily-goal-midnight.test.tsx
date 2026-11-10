import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useApp, useContainer } from '@/ui-kit/app-context';

import type { DailyGoalView } from '../../contract';
import { MIDNIGHT_SLACK_MS } from '../goal-card.constants';
import { useDailyGoal } from '../hooks';
import { useLocalDay } from '../use-local-day';

jest.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
jest.mock('@/ui-kit/app-context', () => ({ useApp: jest.fn(), useContainer: jest.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Acceptance criterion 8: with the app open over midnight, the card rolls over to the new day.
// Local Date constructors keep this independent of the machine's time zone.
describe('Daily goal at midnight', () => {
  const app = { dataVersion: 0 };
  const execute = jest.fn(async () => ({}) as DailyGoalView);
  const container = { goals: { view: { execute } } };
  let day = '';

  function Probe() {
    useDailyGoal(null);
    day = useLocalDay();
    return null;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 10, 23, 59, 30));
    jest.mocked(useApp).mockImplementation(() => app as unknown as ReturnType<typeof useApp>);
    jest.mocked(useContainer).mockImplementation(() => container as unknown as ReturnType<typeof useContainer>);
    execute.mockClear();
  });

  afterEach(() => jest.useRealTimers());

  it('re-reads the goal and changes the day key just after local midnight', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<Probe />);
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(day).toBe(new Date(2026, 10, 10).toDateString());

    // Not yet: a second before the timer (midnight + slack).
    await act(async () => {
      jest.advanceTimersByTime(30_000 + MIDNIGHT_SLACK_MS - 1000);
    });
    expect(execute).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(day).toBe(new Date(2026, 10, 11).toDateString());
    expect(execute).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });
});
