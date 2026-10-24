import { ACCENT, DARK, LIGHT, ON_ACCENT, ON_LIGHT, RAMP, TIER_LABEL, TYPE_COLOR } from '@cityturfer/brand';
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
  it('calls onPress and, on dark (the app), keeps the accent fill with a white label', () => {
    const onPress = jest.fn();
    const tree = render(
      <ThemeProvider scheme='dark'>
        <Button label='Start' onPress={onPress} testID='go' />
      </ThemeProvider>
    );
    act(() => pressable(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(flat(host(tree, 'go').props.style).backgroundColor).toBe(ACCENT);
    expect(flat(tree.root.findByType(Text).props.style).color).toBe(ON_ACCENT);
    expect(ON_ACCENT).toBe('#FFFFFF');
  });

  it('on light keeps the same pink fill with a night label (AA)', () => {
    const tree = render(
      <ThemeProvider scheme='light'>
        <Button label='Start' onPress={() => {}} testID='go' />
      </ThemeProvider>
    );
    expect(flat(host(tree, 'go').props.style).backgroundColor).toBe(ACCENT);
    expect(flat(tree.root.findByType(Text).props.style).color).toBe(ON_LIGHT);
  });

  it('lets an explicit textColor win in either scheme', () => {
    const tree = render(
      <ThemeProvider scheme='light'>
        <Button label='Ride' onPress={() => {}} color={TYPE_COLOR.cycle} textColor={DARK.bg} />
      </ThemeProvider>
    );
    expect(flat(tree.root.findByType(Text).props.style).color).toBe(DARK.bg);
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

  it('uses the light card colour on light', () => {
    const tree = render(
      <ThemeProvider scheme='light'>
        <Card testID='c'>
          <View />
        </Card>
      </ThemeProvider>
    );
    expect(flat(host(tree, 'c').props.style).backgroundColor).toBe(LIGHT.card);
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

  function badgeFill(scheme: 'dark' | 'light') {
    const tree = render(
      <ThemeProvider scheme={scheme}>
        <ActivityRow
          type='run'
          glyph='🏃'
          title='Run'
          subtitle='Sun'
          value='5 km'
          detail='28:14'
          accessibilityLabel='Run'
          onPress={() => {}}
        />
      </ThemeProvider>
    );
    return tree.root
      .findAllByType(View)
      .map((v) => flat(v.props.style).width === 44 && flat(v.props.style).backgroundColor)
      .find(Boolean);
  }

  it('tints the badge with the activity colour on dark (the app, unchanged)', () => {
    expect(badgeFill('dark')).toBe(tint(TYPE_COLOR.run));
  });

  it('tints the badge with the light graphic variant on light', () => {
    expect(badgeFill('light')).toBe(tint(LIGHT.runGraphic));
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

  it('takes a translated screen-reader sentence', () => {
    const label = 'Siła terytorium: Blade, Świecące, Mocne, Płonące, od najsłabszego do najmocniejszego';
    const tree = render(<TurfLegend testID='legend' accessibilityLabel={label} />);
    expect(host(tree, 'legend').props.accessibilityLabel).toBe(label);
  });

  it('shows only the swatches when compact', () => {
    expect(render(<TurfLegend compact />).root.findAllByType(Text)).toHaveLength(0);
  });
});
