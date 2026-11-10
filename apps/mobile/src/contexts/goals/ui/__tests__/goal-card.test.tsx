import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ACCENT } from '@/constants/colors';
import { applyLanguageSetting, resetLanguageStateForTests } from '@/i18n/language-state';
import { translator } from '@/i18n/translator';
import { useApp, useContainer } from '@/ui-kit/app-context';

import type { DailyGoalView, GoalDay } from '../../contract';
import { GoalCard } from '../goal-card';
import { useDailyGoal, useGoalActions } from '../hooks';

// Plain host components stand in for React Native and the design system (node test environment):
// the card's own logic (state, copy, labels, testIDs) is what is checked here; the look is in
// packages/ui's tests and on the simulator.
jest.mock('react-native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return {
    View: host('View'),
    Text: host('Text'),
    Pressable: host('Pressable'),
    Platform: { OS: 'ios' },
    StyleSheet: { create: <S,>(s: S) => s, hairlineWidth: 1 },
    AppState: { addEventListener: () => ({ remove: () => undefined }) },
  };
});
jest.mock('@/ui-kit/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return { Button: host('Button'), Card: host('Card'), DayStrip: host('DayStrip'), ProgressBar: host('ProgressBar') };
});
// expo-symbols ships ES modules only; a plain host stands in for the flame.
jest.mock('@/ui-kit/symbol', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return { AppSymbol: (props: Record<string, unknown>) => createElement('AppSymbol', props) };
});
jest.mock('@/ui-kit/theme', () => ({
  usePalette: () => ({ text: 'text', muted: 'muted', border: 'border', borderControl: 'control', card: 'card' }),
}));
jest.mock('@/i18n', () => ({ useT: (ns: 'goals') => jest.requireActual('@/i18n/translator').translator(ns) }));
jest.mock('@/ui-kit/app-context', () => ({ useApp: jest.fn(), useContainer: jest.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAYS = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10'];

/** A week ending Tuesday 10 Nov 2026: minutes per day against `goals` (null: no goal that day). */
function view(minutes: number[], goals: (number | null)[], over: Partial<DailyGoalView> = {}): DailyGoalView {
  const week: GoalDay[] = DAYS.map((day, i) => {
    const goal = goals[i];
    const movingS = minutes[i] * 60;
    const startsAt = new Date(`${day}T00:00:00`).getTime();
    return { day, startsAt, goalMinutes: goal, movingS, met: goal != null && movingS >= goal * 60 };
  });
  return { goalMinutes: goals[6], offerHidden: true, today: week[6], week, metBeforeWeek: 0, ...over };
}

const handlers = () => ({ onSet: jest.fn(), onHide: jest.fn(), onChange: jest.fn() });

function render(element: ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const byId = (tree: ReactTestRenderer, testID: string): ReactTestInstance =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.testID === testID);
const text = (node: ReactTestInstance): string => [node.props.children].flat().join('');
const texts = (tree: ReactTestRenderer): string[] => tree.root.findAll((n) => n.type === ('Text' as never)).map(text);

beforeEach(() => resetLanguageStateForTests('en-US'));

describe('GoalCard: offer', () => {
  it('offers a goal until one is set, with Set and Hide', () => {
    const h = handlers();
    const tree = render(
      <GoalCard view={view([0, 0, 0, 0, 0, 0, 0], Array(7).fill(null), { offerHidden: false })} {...h} />
    );
    expect(byId(tree, 'goal-offer')).toBeTruthy();
    expect(texts(tree)).toEqual([
      'Set a daily goal',
      'Hide',
      "Pick how many minutes a day you'd like to be out. Walks, runs and rides all count.",
    ]);
    expect(byId(tree, 'goal-offer-set').props.label).toBe('Set a goal');
    expect(byId(tree, 'goal-offer-hide').props.accessibilityLabel).toBe('Hide the daily goal offer');
    act(() => byId(tree, 'goal-offer-set').props.onPress());
    act(() => byId(tree, 'goal-offer-hide').props.onPress());
    expect(h.onSet).toHaveBeenCalledTimes(1);
    expect(h.onHide).toHaveBeenCalledTimes(1);
    expect(tree.root.findAll((n) => n.props.testID === 'goal-today')).toHaveLength(0);
  });

  it('shows nothing once the offer is hidden (or the goal turned off)', () => {
    const tree = render(<GoalCard view={view([5, 0, 0, 0, 0, 0, 0], Array(7).fill(null))} {...handlers()} />);
    expect(tree.toJSON()).toBeNull();
  });
});

describe('GoalCard: progress', () => {
  const goals = [null, null, 30, 30, 30, 30, 30];

  it('shows today in whole minutes, what is left, a bar and the week', () => {
    const h = handlers();
    const v = view([20, 0, 35, 12, 31, 0, 18], goals);
    // 18 min 59 s still shows 18: minutes round down.
    v.today = { ...v.today, movingS: 18 * 60 + 59 };
    v.week[6] = v.today;
    const tree = render(<GoalCard view={v} {...h} />);
    expect(text(byId(tree, 'goal-today'))).toBe('18 of 30 min');
    expect(byId(tree, 'goal-today').props.accessibilityLabel).toBe('18 of 30 minutes today');
    expect(text(byId(tree, 'goal-status'))).toBe('12 min to go');
    expect(tree.root.findByType('ProgressBar' as never).props.progress).toBeCloseTo((18 * 60 + 59) / 1800);
    expect(text(byId(tree, 'goal-week-summary'))).toBe('Goal met on 2 days of 7');

    const days = byId(tree, 'goal-strip').props.days;
    expect(days.map((d: { testID: string }) => d.testID)).toEqual(DAYS.map((_, i) => `goal-day-${i}`));
    expect(days.map((d: { label: string }) => d.label)).toEqual(['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue']);
    expect(days[0]).toMatchObject({ noTarget: true, accessibilityLabel: 'Wednesday: 20 minutes, no goal set' });
    expect(days[1].accessibilityLabel).toBe('Thursday: 0 minutes, no goal set');
    expect(days[2]).toMatchObject({ met: true, accessibilityLabel: 'Friday: 35 of 30 minutes, goal met' });
    expect(days[3]).toMatchObject({ met: false, progress: 12 / 30, accessibilityLabel: 'Saturday: 12 of 30 minutes' });
    expect(days[6]).toMatchObject({ current: true, accessibilityLabel: 'Today: 18 of 30 minutes' });

    act(() => byId(tree, 'goal-edit').props.onPress());
    expect(h.onChange).toHaveBeenCalledTimes(1);
    expect(byId(tree, 'goal-edit').props.accessibilityLabel).toBe('Change the daily goal');
  });

  it('says when the goal is met, and invites a short walk on an empty day (never "missed")', () => {
    const met = render(<GoalCard view={view([0, 0, 0, 0, 0, 0, 32], goals)} {...handlers()} />);
    expect(text(byId(met, 'goal-status'))).toBe('Goal met · 32 min today');
    expect(text(byId(met, 'goal-week-summary'))).toBe('Goal met on 1 day of 7');
    const empty = render(<GoalCard view={view([0, 0, 0, 0, 0, 0, 0], goals)} {...handlers()} />);
    expect(text(byId(empty, 'goal-status'))).toBe('Nothing yet today. A short walk counts.');
    expect(text(byId(empty, 'goal-week-summary'))).toBe('Every day starts fresh');
    expect([...texts(met), ...texts(empty)].join(' ')).not.toMatch(/missed|behind|lost|broke/i);
  });
});

describe('GoalCard in Polish', () => {
  beforeEach(() => applyLanguageSetting('pl', 'en-US'));

  it('uses the Polish genitive after "z" and Polish weekday names', () => {
    const tree = render(
      <GoalCard view={view([20, 1, 2, 5, 31, 0, 18], [null, null, null, 30, 30, 30, 30])} {...handlers()} />
    );
    expect(text(byId(tree, 'goal-today'))).toBe('18 z 30 min');
    expect(byId(tree, 'goal-today').props.accessibilityLabel).toBe('Dziś 18 z 30 minut');
    expect(text(byId(tree, 'goal-status'))).toBe('Jeszcze 12 min');
    const days = byId(tree, 'goal-strip').props.days;
    expect(days.map((d: { label: string }) => d.label)).toEqual([
      'śr.',
      'czw.',
      'pt.',
      'sob.',
      'niedz.',
      'pon.',
      'wt.',
    ]);
    expect(days.slice(0, 3).map((d: { accessibilityLabel: string }) => d.accessibilityLabel)).toEqual([
      'środa: 20 minut, cel nieustawiony',
      'czwartek: 1 minuta, cel nieustawiony',
      'piątek: 2 minuty, cel nieustawiony',
    ]);
    expect(days[4].accessibilityLabel).toBe('niedziela: 31 z 30 minut, cel osiągnięty');
    expect(days[6].accessibilityLabel).toBe('Dziś: 18 z 30 minut');
  });

  it('covers one, few, many and other in every plural', () => {
    const t = translator('goals', 'pl');
    expect([1, 2, 5, 22, 25, 1.5].map((count) => t('weekSummary', { count }))).toEqual([
      'Cel osiągnięty w 1 dniu z 7',
      'Cel osiągnięty w 2 dniach z 7',
      'Cel osiągnięty w 5 dniach z 7',
      'Cel osiągnięty w 22 dniach z 7',
      'Cel osiągnięty w 25 dniach z 7',
      'Cel osiągnięty w 1,5 dnia z 7',
    ]);
    expect([1, 2, 5, 22, 1.5].map((minutes) => t('settingValue', { minutes }))).toEqual([
      '1 minuta dziennie',
      '2 minuty dziennie',
      '5 minut dziennie',
      '22 minuty dziennie',
      '1,5 minuty dziennie',
    ]);
    expect([1, 22, 25].map((goal) => t('progressLabel', { done: 0, goal }))).toEqual([
      'Dziś 0 z 1 minuty',
      'Dziś 0 z 22 minut',
      'Dziś 0 z 25 minut',
    ]);
    expect(t('weekSummary', { count: 0 })).toBe('Każdy dzień to nowy początek');
    expect(t('met', { done: 32 })).toBe('Cel dnia osiągnięty · 32 min dziś');
  });
});

describe('GoalCard: streak', () => {
  const goals = [30, 30, 30, 30, 30, 30, 30];

  it('shows the days in a row with the goal met, counting days before the week', () => {
    const tree = render(
      <GoalCard view={view([30, 30, 30, 30, 30, 30, 30], goals, { metBeforeWeek: 114 })} {...handlers()} />
    );
    expect(text(byId(tree, 'goal-streak-days'))).toBe('121-day streak');
    expect(byId(tree, 'goal-streak').props.accessibilityLabel).toBe('Streak: goal met 121 days in a row');
  });

  it("keeps yesterday's run while today is still open, and asks to keep it going", () => {
    const tree = render(<GoalCard view={view([0, 0, 0, 0, 30, 31, 10], goals)} {...handlers()} />);
    expect(text(byId(tree, 'goal-streak-days'))).toBe('2-day streak');
    expect(byId(tree, 'goal-streak').props.accessibilityLabel).toBe(
      "Streak: goal met 2 days in a row. Meet today's goal to keep it going"
    );
  });

  it('invites a start without a number when there is no streak', () => {
    const tree = render(<GoalCard view={view([30, 0, 0, 0, 0, 0, 0], goals)} {...handlers()} />);
    expect(tree.root.findAll((n) => n.props.testID === 'goal-streak-days')).toHaveLength(0);
    expect(texts(tree)).toContain('Meet your goal today to start a streak');
    // iOS: an unlit outline flame in the control-border colour.
    expect(tree.root.findByType('AppSymbol' as never).props).toMatchObject({ name: 'flame', color: 'control' });
  });

  it('draws no flame on Android without a streak (its emoji fallback ignores colour)', () => {
    const platform = jest.requireMock<{ Platform: { OS: string } }>('react-native').Platform;
    platform.OS = 'android';
    try {
      const none = render(<GoalCard view={view([30, 0, 0, 0, 0, 0, 0], goals)} {...handlers()} />);
      expect(none.root.findAllByType('AppSymbol' as never)).toHaveLength(0);
      const lit = render(<GoalCard view={view([0, 0, 0, 0, 0, 30, 30], goals)} {...handlers()} />);
      expect(lit.root.findByType('AppSymbol' as never).props).toMatchObject({ name: 'flame.fill', color: ACCENT });
    } finally {
      platform.OS = 'ios';
    }
  });

  it('has every Polish plural form', () => {
    const t = translator('goals', 'pl');
    expect([1, 2, 5, 22, 121].map((count) => t('streak', { count }))).toEqual([
      'Seria: 1 dzień',
      'Seria: 2 dni',
      'Seria: 5 dni',
      'Seria: 22 dni',
      'Seria: 121 dni',
    ]);
  });
});

describe('useDailyGoal', () => {
  const app = { dataVersion: 0 };
  const execute = jest.fn<Promise<DailyGoalView>, []>();
  // One object, like the app's container: a new one each render would re-run the read.
  const setGoal = jest.fn(async (_: number | null) => undefined);
  const container = { goals: { view: { execute }, set: { execute: setGoal } } };
  let seen: DailyGoalView | null = null;
  type Live = { movingS: number; startedAt: number } | null;
  function Probe({ live }: { live: Live }) {
    seen = useDailyGoal(live);
    return null;
  }

  beforeEach(() => {
    jest.mocked(useApp).mockImplementation(() => app as unknown as ReturnType<typeof useApp>);
    jest.mocked(useContainer).mockImplementation(() => container as unknown as ReturnType<typeof useContainer>);
    app.dataVersion = 0;
    seen = null;
    execute.mockReset();
  });

  async function mount(live: Live) {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<Probe live={live} />);
    });
    return tree;
  }

  it('adds the live recording to today and counts a finished one once, from the stored Activity', async () => {
    const goals = [30, 30, 30, 30, 30, 30, 30];
    execute.mockResolvedValueOnce(view([0, 0, 0, 0, 0, 0, 10], goals));
    const tree = await mount({ movingS: 25 * 60, startedAt: new Date('2026-11-10T09:00:00').getTime() });
    expect(seen?.today.movingS).toBe(35 * 60);
    expect(seen?.today.met).toBe(true);
    expect(seen?.week[6].movingS).toBe(35 * 60);

    // Finished: Recording clears its live snapshot, then the saved Activity bumps dataVersion.
    execute.mockResolvedValueOnce(view([0, 0, 0, 0, 0, 0, 35], goals));
    app.dataVersion = 1;
    await act(async () => {
      tree.update(<Probe live={null} />);
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(seen?.today.movingS).toBe(35 * 60);
    act(() => tree.unmount()); // clears the midnight timer
  });
  it('re-reads at once after the goal is set, without waiting for the outbox', async () => {
    const goals = [30, 30, 30, 30, 30, 30, 30];
    execute.mockResolvedValue(view([0, 0, 0, 0, 0, 0, 10], goals));
    let actions!: ReturnType<typeof useGoalActions>;
    function Editor() {
      actions = useGoalActions();
      return null;
    }
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <>
          <Probe live={null} />
          <Editor />
        </>
      );
    });
    expect(execute).toHaveBeenCalledTimes(1);
    await act(async () => {
      await actions.set(45);
    });
    expect(setGoal).toHaveBeenCalledWith(45);
    expect(execute).toHaveBeenCalledTimes(2); // dataVersion unchanged
    act(() => tree.unmount());
  });
});
