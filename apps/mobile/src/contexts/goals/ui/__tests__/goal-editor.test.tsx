import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { resetLanguageStateForTests } from '@/i18n/language-state';

import type { DailyGoalView } from '../../contract';
import { DAILY_GOAL_LIMITS } from '../../index';
import { GoalEditor } from '../goal-editor';
import { useDailyGoal, useGoalActions } from '../hooks';

// Plain host components stand in for React Native and the design system (node test environment),
// as in goal-card.test.tsx: the editor's own logic (stepping, bounds, save, turn off) is checked.
jest.mock('react-native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return {
    View: host('View'),
    Text: host('Text'),
    Pressable: host('Pressable'),
    ActivityIndicator: host('ActivityIndicator'),
    Platform: { OS: 'ios' },
    StyleSheet: { create: <S,>(s: S) => s, hairlineWidth: 1 },
  };
});
jest.mock('@/ui-kit/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return { Button: host('Button') };
});
jest.mock('@/ui-kit/theme', () => ({
  usePalette: () => ({ text: 'text', muted: 'muted', border: 'border', borderControl: 'control', card: 'card' }),
}));
jest.mock('@/i18n', () => ({ useT: (ns: 'goals') => jest.requireActual('@/i18n/translator').translator(ns) }));
jest.mock('../hooks', () => ({ useDailyGoal: jest.fn(), useGoalActions: jest.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Only what the editor reads: the goal in force. */
const viewWith = (goalMinutes: number | null) => ({ goalMinutes }) as DailyGoalView;

const set = jest.fn(async (_: number | null) => undefined);
const onDone = jest.fn();

function render(goalMinutes: number | null): ReactTestRenderer {
  jest.mocked(useDailyGoal).mockReturnValue(viewWith(goalMinutes));
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<GoalEditor onDone={onDone} />);
  });
  return tree;
}

const byId = (tree: ReactTestRenderer, testID: string): ReactTestInstance =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.testID === testID);
const allById = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === testID);
/** The minutes on screen, from the adjustable element's spoken value. */
const shown = (tree: ReactTestRenderer): number =>
  Number(/\d+/.exec(byId(tree, 'goal-value').props.accessibilityValue.text)?.[0]);
const press = (tree: ReactTestRenderer, testID: string, times = 1) => {
  for (let i = 0; i < times; i++) {
    act(() => {
      const node = byId(tree, testID);
      if (!node.props.disabled) {
        node.props.onPress();
      }
    });
  }
};
const adjust = (tree: ReactTestRenderer, actionName: 'increment' | 'decrement') =>
  act(() => byId(tree, 'goal-value').props.onAccessibilityAction({ nativeEvent: { actionName } }));

beforeEach(() => {
  resetLanguageStateForTests('en-US');
  set.mockClear();
  onDone.mockClear();
  jest.mocked(useGoalActions).mockReturnValue({ set, hideOffer: jest.fn() });
});

describe('GoalEditor', () => {
  it('starts from the suggested 30 minutes without a goal, and offers no Turn off', () => {
    const tree = render(null);
    expect(DAILY_GOAL_LIMITS.suggested).toBe(30);
    expect(shown(tree)).toBe(30);
    expect(allById(tree, 'goal-off')).toHaveLength(0);
  });

  it('starts from the goal in force and offers Turn off', () => {
    const tree = render(45);
    expect(shown(tree)).toBe(45);
    expect(allById(tree, 'goal-off')).toHaveLength(1);
  });

  it('steps by 5 and stops at 10 minutes: minus disabled at the bottom', () => {
    const tree = render(20);
    press(tree, 'goal-minus');
    expect(shown(tree)).toBe(15);
    press(tree, 'goal-minus', 5);
    expect(shown(tree)).toBe(DAILY_GOAL_LIMITS.min);
    expect(byId(tree, 'goal-minus').props.disabled).toBe(true);
    expect(byId(tree, 'goal-minus').props.accessibilityState).toEqual({ disabled: true });
    expect(byId(tree, 'goal-plus').props.disabled).toBe(false);
    // Even if pressed (or announced) at the bound, it stays at 10.
    act(() => byId(tree, 'goal-minus').props.onPress());
    adjust(tree, 'decrement');
    expect(shown(tree)).toBe(DAILY_GOAL_LIMITS.min);
  });

  it('stops at 180 minutes: plus disabled at the top', () => {
    const tree = render(170);
    press(tree, 'goal-plus', 4);
    expect(shown(tree)).toBe(DAILY_GOAL_LIMITS.max);
    expect(byId(tree, 'goal-plus').props.disabled).toBe(true);
    act(() => byId(tree, 'goal-plus').props.onPress());
    adjust(tree, 'increment');
    expect(shown(tree)).toBe(DAILY_GOAL_LIMITS.max);
  });

  it('steps with the screen reader increment and decrement actions', () => {
    const tree = render(null);
    adjust(tree, 'increment');
    adjust(tree, 'increment');
    expect(shown(tree)).toBe(40);
    adjust(tree, 'decrement');
    expect(shown(tree)).toBe(35);
    expect(byId(tree, 'goal-value').props.accessibilityRole).toBe('adjustable');
  });

  it('saves the stepped value and closes', async () => {
    const tree = render(null);
    press(tree, 'goal-plus', 3);
    await act(async () => {
      byId(tree, 'goal-save').props.onPress();
    });
    expect(set).toHaveBeenCalledWith(45);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('turns the goal off with null and closes', async () => {
    const tree = render(60);
    await act(async () => {
      byId(tree, 'goal-off').props.onPress();
    });
    expect(set).toHaveBeenCalledWith(null);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
