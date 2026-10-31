import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useApp, useContainer } from '@/ui-kit/app-context';

import type { DistrictsView } from '../../contract';
import { useChooseHomeCity, useDistricts } from '../hooks';

// The hook's world: the app context (data version, container) and the use cases it calls.
const app = { dataVersion: 0 };
const execute = jest.fn<Promise<DistrictsView>, [{ readonly aborted: boolean }]>();
const chooseHomeCity = jest.fn(async (_: string | null) => undefined);
const container = { territory: { districts: { execute }, chooseHomeCity: { execute: chooseHomeCity } } };

jest.mock('@/ui-kit/app-context', () => ({ useApp: jest.fn(), useContainer: jest.fn() }));
// Loaded by hooks.ts for other hooks; its native module has no place in a node test.
jest.mock('../../infrastructure/turf-overlay-preference', () => ({ turfOverlayPreference: {} }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const answer = (name: string) => ({ status: 'no-data', city: { name } }) as unknown as DistrictsView;

/** A promise the test settles by hand, to hold a read open. */
function deferred() {
  let resolve!: (v: DistrictsView) => void;
  const promise = new Promise<DistrictsView>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let seen: DistrictsView | null | undefined;
let choose: (cityId: string | null) => Promise<void>;
function Probe() {
  seen = useDistricts();
  choose = useChooseHomeCity();
  return null;
}

async function mount(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Probe />);
  });
  return tree;
}

async function rerender(tree: ReactTestRenderer) {
  await act(async () => {
    tree.update(<Probe />);
  });
}

beforeEach(() => {
  jest.mocked(useApp).mockImplementation(() => app as unknown as ReturnType<typeof useApp>);
  jest.mocked(useContainer).mockImplementation(() => container as unknown as ReturnType<typeof useContainer>);
  app.dataVersion = 0;
  seen = undefined;
  execute.mockReset();
  chooseHomeCity.mockClear();
});

describe('useDistricts', () => {
  it('reads once on mount and shows the answer', async () => {
    execute.mockResolvedValue(answer('Gdańsk'));
    const tree = await mount();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(answer('Gdańsk'));
    tree.unmount();
  });

  it('re-reads when the data version changes (new turf saved) and shows the new answer', async () => {
    execute.mockResolvedValueOnce(answer('before')).mockResolvedValueOnce(answer('after'));
    const tree = await mount();
    await rerender(tree);
    expect(execute).toHaveBeenCalledTimes(1); // same data version: no new read
    app.dataVersion = 1;
    await rerender(tree);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(answer('after'));
    tree.unmount();
  });

  it('a newer read aborts the one still running, whose late answer is dropped', async () => {
    const slow = deferred();
    execute.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(answer('newer'));
    const tree = await mount();
    const firstSignal = execute.mock.calls[0][0];
    app.dataVersion = 1;
    await rerender(tree);
    expect(firstSignal.aborted).toBe(true);
    expect(execute.mock.calls[1][0].aborted).toBe(false);
    await act(async () => {
      slow.resolve(answer('stale'));
    });
    expect(seen).toEqual(answer('newer'));
    tree.unmount();
  });

  it('re-reads when a Home City is chosen on another screen', async () => {
    execute.mockResolvedValueOnce(answer('none')).mockResolvedValueOnce(answer('Gdańsk'));
    const tree = await mount();
    await act(async () => {
      await choose('pl-gdansk');
    });
    expect(chooseHomeCity).toHaveBeenCalledWith('pl-gdansk');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(answer('Gdańsk'));
    tree.unmount();
  });

  it('leaving the screen aborts the read in flight', async () => {
    const slow = deferred();
    execute.mockReturnValueOnce(slow.promise);
    const tree = await mount();
    act(() => {
      tree.unmount();
    });
    expect(execute.mock.calls[0][0].aborted).toBe(true);
  });
});
