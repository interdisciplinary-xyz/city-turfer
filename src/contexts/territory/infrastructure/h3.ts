/**
 * Loads h3-js safely on Hermes. h3-js evaluates `new TextDecoder("utf-16le")`
 * at module load whenever TextDecoder exists; Hermes' TextDecoder only
 * supports UTF-8 and throws RangeError. h3-js falls back to its own decoder
 * when TextDecoder is undefined, so hide it during the require.
 */
type H3 = typeof import('h3-js');

const g = globalThis as { TextDecoder?: unknown };
const saved = g.TextDecoder;
g.TextDecoder = undefined;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const h3: H3 = require('h3-js');
g.TextDecoder = saved;

export const { cellArea, cellToBoundary, cellToLatLng, cellToParent, getHexagonEdgeLengthAvg, latLngToCell } = h3;
