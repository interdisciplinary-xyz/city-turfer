import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { createSharePhotoApi } from '../../index';
import { fakeSharePhotoDeps } from '../../test-support/fakes';
import { SharePromptCard } from '../share-prompt-card';

// Plain host components stand in for React Native and the design system (node test environment).
jest.mock('react-native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return {
    View: host('View'),
    Text: host('Text'),
    Pressable: host('Pressable'),
    Modal: host('Modal'),
    Linking: { openSettings: jest.fn() },
    StyleSheet: { create: <S,>(s: S) => s, absoluteFill: {} },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/ui-kit/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return { Button: host('Button'), Card: host('Card') };
});
jest.mock('@/ui-kit/theme', () => ({
  usePalette: () => ({ text: 'text', muted: 'muted', border: 'border', card: 'card' }),
}));
jest.mock('@/i18n', () => ({ useT: (ns: 'share') => jest.requireActual('@/i18n/translator').translator(ns, 'en') }));

const mockFake = fakeSharePhotoDeps();
const mockApi = createSharePhotoApi(mockFake.deps);
jest.mock('../share-photo-api', () => ({
  get sharePhoto() {
    return mockApi;
  },
}));
const fake = mockFake;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(element: ReactElement): Promise<ReactTestRenderer> {
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = create(element);
  });
  return tree!;
}

const byTestId = (tree: ReactTestRenderer, id: string): ReactTestInstance | undefined =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id)[0];

beforeEach(() => fake.flags.clear());

describe('SharePromptCard', () => {
  it('shows right after Finish with its four choices', async () => {
    const tree = await render(<SharePromptCard userId='u1' justFinished onPicked={jest.fn()} />);
    for (const id of [
      'share-prompt',
      'share-prompt-camera',
      'share-prompt-library',
      'share-prompt-dismiss',
      'share-prompt-never',
    ]) {
      expect(byTestId(tree, id)).toBeDefined();
    }
  });

  it('never when the activity was opened from History', async () => {
    const tree = await render(<SharePromptCard userId='u1' justFinished={false} onPicked={jest.fn()} />);
    expect(byTestId(tree, 'share-prompt')).toBeUndefined();
  });

  it('Not now hides it for this visit only', async () => {
    const tree = await render(<SharePromptCard userId='u1' justFinished onPicked={jest.fn()} />);
    await act(async () => byTestId(tree, 'share-prompt-dismiss')!.props.onPress());
    expect(byTestId(tree, 'share-prompt')).toBeUndefined();
    expect(fake.flags.has('u1')).toBe(false);
  });

  it("Don't ask again hides it now and after the next Finish", async () => {
    const tree = await render(<SharePromptCard userId='u1' justFinished onPicked={jest.fn()} />);
    await act(async () => byTestId(tree, 'share-prompt-never')!.props.onPress());
    expect(byTestId(tree, 'share-prompt')).toBeUndefined();
    expect(fake.flags.has('u1')).toBe(true);
    const next = await render(<SharePromptCard userId='u1' justFinished onPicked={jest.fn()} />);
    expect(byTestId(next, 'share-prompt')).toBeUndefined();
  });

  it('Choose from library hands the picked photo on and hides the card', async () => {
    const onPicked = jest.fn();
    const tree = await render(<SharePromptCard userId='u1' justFinished onPicked={onPicked} />);
    await act(async () => byTestId(tree, 'share-prompt-library')!.props.onPress());
    expect(onPicked).toHaveBeenCalledWith({ uri: 'file:///cache/library.jpg', width: 1170, height: 2532 });
    expect(byTestId(tree, 'share-prompt')).toBeUndefined();
  });
});
