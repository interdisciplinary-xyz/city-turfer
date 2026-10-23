// The h3 loader on a Hermes-like runtime: a TextDecoder that only knows UTF-8. h3-js builds a
// UTF-16LE decoder at load whenever TextDecoder exists, so the loader must hide it during the
// import and put the very same object back afterwards.

class Utf8OnlyTextDecoder {
  constructor(label = 'utf-8') {
    if (label.toLowerCase() !== 'utf-8' && label.toLowerCase() !== 'utf8') {
      throw new RangeError(`Unknown encoding: ${label}`);
    }
  }
  decode(): string {
    return '';
  }
}

type Loader = typeof import('../h3');
type H3 = typeof import('h3-js');

// Fresh module registry per load, so each case evaluates h3-js and the loader from scratch.
function load<T>(id: '../h3' | 'h3-js'): T {
  let mod: T | undefined;
  jest.isolateModules(() => {
    mod = id === '../h3' ? require('../h3') : require('h3-js');
  });
  return mod as T;
}

const g = globalThis as { TextDecoder?: unknown };
const realTextDecoder = g.TextDecoder;

afterEach(() => {
  g.TextDecoder = realTextDecoder;
});

it('h3-js itself fails to load under a UTF-8-only TextDecoder (why the loader exists)', () => {
  g.TextDecoder = Utf8OnlyTextDecoder;
  expect(() => load<H3>('h3-js')).toThrow(RangeError);
});

it('loads h3-js under a UTF-8-only TextDecoder and restores the original afterwards', () => {
  g.TextDecoder = Utf8OnlyTextDecoder;
  const loader = load<Loader>('../h3');

  expect(g.TextDecoder).toBe(Utf8OnlyTextDecoder);
  expect(Object.getOwnPropertySymbols(globalThis).map(String)).not.toContain(
    'Symbol(@cityturfer/core/h3:saved-TextDecoder)'
  );

  g.TextDecoder = realTextDecoder;
  const reference = load<H3>('h3-js');
  const cell = loader.latLngToCell(52, 21, 11);
  expect(cell).toBe(reference.latLngToCell(52, 21, 11));
  expect(loader.cellToParent(cell, 9)).toBe(reference.cellToParent(cell, 9));
});

it('leaves a runtime without TextDecoder without one', () => {
  g.TextDecoder = undefined;
  load<Loader>('../h3');
  expect(g.TextDecoder).toBeUndefined();
});
