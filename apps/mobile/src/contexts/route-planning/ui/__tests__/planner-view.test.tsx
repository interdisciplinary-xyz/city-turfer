import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { resetLanguageStateForTests } from '@/i18n/language-state';
import { DomainError } from '@/shared-kernel';

import type { PlannedRouteView, RoutingConsentState } from '../../contract';
import { usePlannerActions, useRoutingConsent } from '../hooks';
import { PlannerView } from '../planner-view';
import { plannedTime, plannerErrorKey, routeBounds } from '../planner-view.constants';

// Plain host components stand in for React Native, MapLibre and the design system (node test
// environment): the planner's own logic (state, copy, labels, testIDs) is checked here; the map
// itself is checked on the simulator.
jest.mock('react-native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return {
    View: host('View'),
    Text: host('Text'),
    Pressable: host('Pressable'),
    Modal: (props: Record<string, unknown>) =>
      props.visible ? createElement('Modal', props, props.children as never) : null,
    ActivityIndicator: host('ActivityIndicator'),
    AccessibilityInfo: { announceForAccessibility: jest.fn(), isReduceMotionEnabled: () => Promise.resolve(false) },
    StyleSheet: { create: <S,>(s: S) => s, absoluteFill: {} },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@maplibre/maplibre-react-native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return { Map: host('Map'), Camera: host('Camera'), UserLocation: host('UserLocation') };
});
jest.mock('../planned-route-layer', () => ({ PlannedRouteLayers: () => null }));
jest.mock('@/ui-kit/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return { Button: host('Button'), Stat: host('Stat') };
});
jest.mock('@/ui-kit/symbol', () => ({ AppSymbol: () => null, ActivitySymbol: () => null }));
jest.mock('@/i18n', () => ({ useT: (ns: 'planner') => jest.requireActual('@/i18n/translator').translator(ns) }));
jest.mock('../hooks', () => ({ usePlannerActions: jest.fn(), useRoutingConsent: jest.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function plan(over: Partial<PlannedRouteView> = {}): PlannedRouteView {
  return {
    type: 'walk',
    waypoints: [],
    legs: [],
    isLoop: false,
    distanceM: 0,
    durationS: 0,
    cellCount: 0,
    newCellCount: 0,
    newAreaM2: 0,
    newCells: [],
    showOnRecord: false,
    updatedAt: null,
    ...over,
  };
}

const twoPoints = (snapped: boolean) =>
  plan({
    waypoints: [
      { lat: 54.35, lon: 18.65 },
      { lat: 54.36, lon: 18.66 },
    ],
    legs: [
      {
        coordinates: [
          [18.65, 54.35],
          [18.66, 54.36],
        ],
        snapped,
        distanceM: 2450,
      },
    ],
    distanceM: 2450,
    durationS: 1750,
    cellCount: 60,
    newCellCount: 42,
    newAreaM2: 21000,
    updatedAt: 1,
  });

let actions: Record<string, jest.Mock>;
let setConsent: jest.Mock;
function setup(consent: RoutingConsentState) {
  actions = {
    add: jest.fn(() => Promise.resolve(plan())),
    undo: jest.fn(() => Promise.resolve(plan())),
    clear: jest.fn(() => Promise.resolve(plan())),
    closeLoop: jest.fn(() => Promise.resolve(plan())),
    setType: jest.fn(() => Promise.resolve(plan())),
    snap: jest.fn(() => Promise.resolve(plan())),
    showOnRecord: jest.fn(() => Promise.resolve(plan())),
  };
  setConsent = jest.fn(() => Promise.resolve());
  jest.mocked(usePlannerActions).mockReturnValue(actions as never);
  jest.mocked(useRoutingConsent).mockReturnValue([consent, setConsent]);
}

function render(element: ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  return tree;
}
const all = (tree: ReactTestRenderer, testID: string): ReactTestInstance[] =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === testID);
const byId = (tree: ReactTestRenderer, testID: string): ReactTestInstance => all(tree, testID)[0];
const text = (node: ReactTestInstance): string => [node.props.children].flat().join('');
const tap = async (tree: ReactTestRenderer, lon: number, lat: number) =>
  act(async () => byId(tree, 'planner-map').props.onPress({ nativeEvent: { lngLat: [lon, lat] } }));

beforeEach(() => resetLanguageStateForTests('en-US'));

describe('PlannerView', () => {
  it('starts empty: a hint, and nothing to undo, loop or use on Record', () => {
    setup('granted');
    const tree = render(<PlannerView route={plan()} cityCenter={[18.65, 54.35]} />);
    expect(text(byId(tree, 'planner-hint'))).toBe('Tap the map to add your start');
    expect(byId(tree, 'planner-undo').props.disabled).toBe(true);
    expect(byId(tree, 'planner-close-loop').props.disabled).toBe(true);
    const use = byId(tree, 'planner-use-on-record');
    expect(use.props).toMatchObject({
      accessibilityRole: 'switch',
      accessibilityState: { checked: false, disabled: true },
    });
    // Opens on the Home City and follows the Turfer until the first tap.
    expect(tree.root.findByType('Camera' as never).props).toMatchObject({
      initialViewState: { center: [18.65, 54.35], zoom: 15 },
      trackUserLocation: 'default',
    });
  });

  it('adds a tapped point and asks once about streets while consent is unasked', async () => {
    setup('unasked');
    const tree = render(<PlannerView route={plan()} cityCenter={null} />);
    await tap(tree, 18.6, 54.3);
    expect(actions.add).toHaveBeenCalledWith({ lat: 54.3, lon: 18.6 });
    expect(all(tree, 'routing-consent-sheet')).toHaveLength(1);
    expect(tree.root.findByType('Camera' as never).props.trackUserLocation).toBeUndefined();
    await act(async () => byId(tree, 'routing-consent-straight').props.onPress());
    expect(setConsent).toHaveBeenCalledWith(false);
    expect(all(tree, 'routing-consent-sheet')).toHaveLength(0);
    await tap(tree, 18.61, 54.31);
    expect(all(tree, 'routing-consent-sheet')).toHaveLength(0);
  });

  it('never asks when consent is already answered', async () => {
    setup('declined');
    const tree = render(<PlannerView route={plan()} cityCenter={null} />);
    await tap(tree, 18.6, 54.3);
    expect(all(tree, 'routing-consent-sheet')).toHaveLength(0);
  });

  it('shows distance, time and ≈ new cells, read out with units spelled out', () => {
    setup('granted');
    const tree = render(<PlannerView route={twoPoints(true)} cityCenter={null} />);
    expect(byId(tree, 'planner-distance').props).toMatchObject({ value: '2.45', unit: 'km' });
    expect(byId(tree, 'planner-time').props.value).toBe('29 min');
    expect(byId(tree, 'planner-new-cells').props.value).toBe('≈ 42');
    expect(text(byId(tree, 'planner-new-area'))).toBe('≈ 0.02 km² of new turf if you go this way');
    expect(byId(tree, 'planner-stats').props.accessibilityLabel).toBe(
      'Planned route: 2.45 kilometres, about 29 minutes, about 42 new cells'
    );
    expect(all(tree, 'planner-straight')).toHaveLength(0);
    // A restored plan opens fitted to it, without following the Turfer.
    const camera = tree.root.findByType('Camera' as never).props;
    expect(camera.initialViewState.bounds).toEqual([18.65, 54.35, 18.66, 54.36]);
    expect(camera.trackUserLocation).toBeUndefined();
  });

  it('names straight legs and offers streets (declined) or a retry (granted)', async () => {
    setup('declined');
    const declined = render(<PlannerView route={twoPoints(false)} cityCenter={null} />);
    expect(all(declined, 'planner-straight')).toHaveLength(1);
    await act(async () => byId(declined, 'planner-follow-streets').props.onPress());
    expect(all(declined, 'routing-consent-sheet')).toHaveLength(1);
    await act(async () => byId(declined, 'routing-consent-follow').props.onPress());
    expect(setConsent).toHaveBeenCalledWith(true);

    setup('granted');
    const granted = render(<PlannerView route={twoPoints(false)} cityCenter={null} />);
    await act(async () => byId(granted, 'planner-retry').props.onPress());
    expect(actions.snap).toHaveBeenCalledTimes(1);
  });

  it('toggles Use on Record, and explains a refused edit in words', async () => {
    setup('granted');
    const tree = render(<PlannerView route={twoPoints(true)} cityCenter={null} />);
    await act(async () => byId(tree, 'planner-use-on-record').props.onPress());
    expect(actions.showOnRecord).toHaveBeenCalledWith(true);
    const shown = render(<PlannerView route={{ ...twoPoints(true), showOnRecord: true }} cityCenter={null} />);
    expect(byId(shown, 'planner-use-on-record').props.accessibilityState).toMatchObject({ checked: true });

    actions.add.mockRejectedValueOnce(new DomainError('planned-route.too-many-waypoints', '30'));
    await tap(tree, 18.7, 54.4);
    expect(text(byId(tree, 'planner-error'))).toBe('A route can have up to 30 stops. Undo one to change the end.');
  });

  it('changes the type from the chips', async () => {
    setup('granted');
    const tree = render(<PlannerView route={plan()} cityCenter={null} />);
    expect(byId(tree, 'planner-type-walk').props.accessibilityState).toMatchObject({ selected: true });
    await act(async () => byId(tree, 'planner-type-cycle').props.onPress());
    expect(actions.setType).toHaveBeenCalledWith('cycle');
  });
});

describe('planner helpers', () => {
  it('maps the Planned Route codes to messages, anything else to the generic one', () => {
    expect(plannerErrorKey(new DomainError('planned-route.loop-too-short'))).toBe('errors.loopTooShort');
    expect(plannerErrorKey(new DomainError('planned-route.too-short'))).toBe('errors.tooShort');
    expect(plannerErrorKey(new Error('disk full'))).toBe('errors.generic');
  });

  it('bounds the waypoints and legs, and splits the time into hours and minutes', () => {
    expect(routeBounds(plan())).toBeNull();
    expect(routeBounds(twoPoints(true))).toEqual([18.65, 54.35, 18.66, 54.36]);
    expect(plannedTime(3900)).toEqual({ hours: 1, minutes: 5, totalMinutes: 65 });
    expect(plannedTime(29)).toEqual({ hours: 0, minutes: 0, totalMinutes: 0 });
  });
});
