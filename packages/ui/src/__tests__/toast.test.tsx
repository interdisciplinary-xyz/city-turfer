import { ACCENT, DARK } from '@cityturfer/brand';
import type { ReactElement } from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ThemeProvider, Toast } from '../index';

function render(element: ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<ThemeProvider scheme='dark'>{element}</ThemeProvider>);
  });
  return tree!;
}

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;

function host(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  return tree.root.find((n) => typeof n.type === 'string' && n.props.testID === testID);
}

const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map((t) => t.props.children);

describe('Toast', () => {
  it('a success reads its message politely, with a check mark on the accent', () => {
    const tree = render(<Toast variant='success' message='Backed up.' testID='t' />);
    const node = host(tree, 't');
    expect(node.props.accessibilityRole).toBe('text');
    expect(node.props.accessibilityLabel).toBe('Backed up.');
    expect(node.props.accessibilityLiveRegion).toBe('polite');
    expect(texts(tree)).toEqual(['✓', 'Backed up.']);
    const marks = tree.root.findAll(
      (n) => typeof n.type === 'string' && flat(n.props.style).backgroundColor === ACCENT
    );
    expect(marks.length).toBeGreaterThan(0);
  });

  it('an error is an assertive alert with its own mark in the danger colour', () => {
    const tree = render(<Toast variant='error' message='No connection.' testID='t' />);
    const node = host(tree, 't');
    expect(node.props.accessibilityRole).toBe('alert');
    expect(node.props.accessibilityLiveRegion).toBe('assertive');
    expect(texts(tree)).toEqual(['!', 'No connection.']);
    const marks = tree.root.findAll(
      (n) => typeof n.type === 'string' && flat(n.props.style).backgroundColor === DARK.danger
    );
    expect(marks.length).toBeGreaterThan(0);
  });

  it('closes on a tap when it can be dismissed, and says so', () => {
    const onDismiss = jest.fn();
    const tree = render(<Toast variant='error' message='Oops.' onDismiss={onDismiss} dismissHint='Close' testID='t' />);
    const pressable = tree.root.findAll((n) => typeof n.props.onPress === 'function').at(-1)!;
    act(() => pressable.props.onPress());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(host(tree, 't').props.accessibilityHint).toBe('Close');
    expect(host(tree, 't').props.accessibilityRole).toBe('alert');
  });

  it('is at least 48 pt tall on the card colour', () => {
    const style = flat(host(render(<Toast variant='success' message='Saved.' testID='t' />), 't').props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.backgroundColor).toBe(DARK.card);
  });
});
