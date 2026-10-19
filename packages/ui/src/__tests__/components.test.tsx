import { ACCENT, DARK, LIGHT, ON_ACCENT, RAMP, TIER_LABEL, TYPE_COLOR } from '@cityturfer/brand';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ActivityRow, Badge, Button, Card, Stat, ThemeProvider, tint, TurfLegend, usePalette } from '../index';

function render(element: ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(element);
  });
  return tree!;
}

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;

/** The native view carrying a testID (not the composite component that received the prop). */
function host(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  return tree.root.find((n) => typeof n.type === 'string' && n.props.testID === testID);
}

/** The innermost element taking `onPress`: React Native's Pressable inside our component. */
function pressable(tree: ReactTestRenderer): ReactTestInstance {
  return tree.root.findAll((n) => typeof n.props.onPress === 'function').at(-1)!;
}

describe('theme', () => {
  function Probe() {
    return <Text>{usePalette().bg}</Text>;
  }

  it('follows the device scheme without a provider (light in tests)', () => {
    expect(render(<Probe />).root.findByType(Text).props.children).toBe(LIGHT.bg);
  });

  it('lets a ThemeProvider force a scheme', () => {
    const tree = render(
      <ThemeProvider scheme='dark'>
        <Probe />
      </ThemeProvider>
    );
    expect(tree.root.findByType(Text).props.children).toBe(DARK.bg);
  });
});

describe('Button', () => {
  it('calls onPress and defaults to the accent with its text colour', () => {
    const onPress = jest.fn();
    const tree = render(<Button label='Start' onPress={onPress} testID='go' />);
    act(() => pressable(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(flat(host(tree, 'go').props.style).backgroundColor).toBe(ACCENT);
    expect(flat(tree.root.findByType(Text).props.style).color).toBe(ON_ACCENT);
  });

  it('is disabled and shows no label while busy', () => {
    const tree = render(<Button label='Saving' onPress={() => {}} busy testID='b' />);
    expect(pressable(tree).props.disabled).toBe(true);
    expect(host(tree, 'b').props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });
});

describe('Stat', () => {
  it('reads value and unit to screen readers and grows when big', () => {
    const tree = render(<Stat label='Distance' value='5.02' unit='km' big testID='d' />);
    const stat = host(tree, 'd');
    expect(stat.props.accessibilityLabel).toBe('Distance 5.02 km');
    expect(flat(tree.root.findAllByType(Text)[0].props.style).fontSize).toBe(52);
  });
});

describe('Card', () => {
  it('uses the theme card colour', () => {
    const tree = render(
      <ThemeProvider scheme='dark'>
        <Card testID='c'>
          <View />
        </Card>
      </ThemeProvider>
    );
    expect(flat(host(tree, 'c').props.style).backgroundColor).toBe(DARK.card);
  });
});

describe('Badge', () => {
  it('draws a circle of the given size with the glyph at half its size', () => {
    const tree = render(<Badge glyph='🏃' tint={tint(TYPE_COLOR.run)} size={52} testID='b' />);
    const style = flat(host(tree, 'b').props.style);
    expect(style).toMatchObject({ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FF8A3D22' });
    expect(flat(tree.root.findByType(Text).props.style).fontSize).toBe(26);
  });
});

describe('ActivityRow', () => {
  it('shows the formatted strings and opens on press', () => {
    const onPress = jest.fn();
    const tree = render(
      <ActivityRow
        type='walk'
        glyph='🚶'
        title='Morning walk'
        subtitle='Mon 19 Oct'
        value='≈ 3.10 km'
        detail='41:02 · 13:14/km'
        accessibilityLabel='Morning walk, Mon 19 Oct, about 3.10 km'
        onPress={onPress}
        testID='row'
      />
    );
    const texts = tree.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toEqual(['🚶', 'Morning walk', 'Mon 19 Oct', '≈ 3.10 km', '41:02 · 13:14/km']);
    act(() => pressable(tree).props.onPress());
    expect(onPress).toHaveBeenCalled();
  });
});

describe('TurfLegend', () => {
  it('steps through the Ramp from weakest to strongest', () => {
    const tree = render(<TurfLegend testID='legend' />);
    const legend = host(tree, 'legend');
    expect(legend.props.accessibilityLabel).toBe(
      'Turf strength: Faint, Glowing, Strong, Blazing, from weakest to strongest'
    );
    const fills = tree.root
      .findAllByType(View)
      .map((v) => flat(v.props.style).backgroundColor)
      .filter((c) => (RAMP as readonly unknown[]).includes(c));
    expect(fills).toEqual([...RAMP]);
    expect(tree.root.findAllByType(Text).map((t) => t.props.children)).toEqual([
      'Turf strength',
      ...Object.values(TIER_LABEL),
    ]);
  });

  it('shows only the swatches when compact', () => {
    expect(render(<TurfLegend compact />).root.findAllByType(Text)).toHaveLength(0);
  });
});
