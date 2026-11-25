import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { NameForm } from '../name-form';

// Plain host components stand in for React Native and the design system (node test environment).
jest.mock('react-native', () => {
  const { createElement, forwardRef } = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    createElement(name, props, props.children as never);
  return {
    View: host('View'),
    Text: host('Text'),
    TextInput: forwardRef((props: Record<string, unknown>, _ref) => createElement('TextInput', props)),
    Platform: { OS: 'ios' },
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
    StyleSheet: { create: <S,>(s: S) => s },
  };
});
jest.mock('@/ui-kit/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return { Button: (props: Record<string, unknown>) => createElement('Button', props) };
});
jest.mock('@/ui-kit/theme', () => ({ usePalette: () => ({ text: 'text', muted: 'muted', danger: 'danger' }) }));
jest.mock('@/i18n', () => ({
  useT: (ns: 'account') => jest.requireActual('@/i18n/translator').translator(ns, 'en'),
}));
jest.mock('@/ui-kit/app-context', () => ({
  useApp: () => ({ auth: { status: 'signed-in', user: { name: 'Ola', accountId: 'acc-1' } } }),
}));
const mockUpdateName = jest.fn();
jest.mock('../hooks', () => ({ useAccountActions: () => ({ updateName: mockUpdateName }) }));
const mockShow = jest.fn();
const mockReport = jest.fn();
jest.mock('@/ui-kit/toast-provider', () => ({
  useToast: () => ({ show: mockShow, reporter: { report: mockReport } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const byTestId = (tree: ReactTestRenderer, id: string): ReactTestInstance =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.testID === id);

function render(onDone = jest.fn()) {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<NameForm onDone={onDone} />);
  });
  return { tree: tree!, onDone };
}

async function save(tree: ReactTestRenderer, name: string) {
  act(() => byTestId(tree, 'account-name-input').props.onChangeText(name));
  await act(async () => byTestId(tree, 'account-name-save').props.onPress());
}

beforeEach(() => {
  mockUpdateName.mockReset();
  mockShow.mockClear();
  mockReport.mockClear();
});

describe('NameForm (the async standard on a form with inline errors)', () => {
  it('saved: back to Account with a "Name saved." toast, nothing reported', async () => {
    mockUpdateName.mockResolvedValue({ kind: 'saved', user: {} });
    const { tree, onDone } = render();
    await save(tree, 'Ola K');
    expect(mockUpdateName).toHaveBeenCalledWith('Ola K');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith({ variant: 'success', message: 'account.toast.nameSaved' });
    expect(mockReport).not.toHaveBeenCalled();
    expect(byTestId(tree, 'account-name-save').props.busy).toBe(false);
  });

  it('offline (a refusal the use case returns): the message inline, no toast, no report', async () => {
    mockUpdateName.mockResolvedValue({ kind: 'offline' });
    const { tree, onDone } = render();
    await save(tree, 'Ola K');
    expect(onDone).not.toHaveBeenCalled();
    expect(byTestId(tree, 'account-name-input').props.accessibilityHint).toMatch(/^No connection/);
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('a crash: reported once, the server message inline (no toast on top), loading off', async () => {
    const bug = new TypeError('undefined is not a function');
    mockUpdateName.mockRejectedValue(bug);
    const { tree } = render();
    await save(tree, 'Ola K');
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(bug, { area: 'identity', code: 'update-name' });
    expect(mockShow).not.toHaveBeenCalled();
    expect(byTestId(tree, 'account-name-input').props.accessibilityHint).toMatch(/hiccup/);
    expect(byTestId(tree, 'account-name-save').props.busy).toBe(false);
  });
});
