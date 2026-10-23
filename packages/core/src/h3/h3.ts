/**
 * Loads h3-js safely on Hermes (see ./hide-text-decoder.ts): TextDecoder is hidden by the first
 * import and restored here, in this module's body, which runs only after both imports have been
 * evaluated. The functions are read off the namespace before restoring, so h3-js is loaded by
 * then even under a lazy-import CommonJS transform. Plain ESM: works under Node/tsx, esbuild,
 * Vitest, Jest and Metro without a CommonJS `require`.
 */
import './hide-text-decoder';

import * as h3 from 'h3-js';

import { SAVED_TEXT_DECODER } from './text-decoder.constants';

const { cellArea, cellToBoundary, cellToLatLng, cellToParent, getHexagonEdgeLengthAvg, latLngToCell } = h3;

const g = globalThis as Record<PropertyKey, unknown>;
const saved = g[SAVED_TEXT_DECODER] as { value: unknown } | undefined;
if (saved) {
  g.TextDecoder = saved.value;
  delete g[SAVED_TEXT_DECODER];
}

export { cellArea, cellToBoundary, cellToLatLng, cellToParent, getHexagonEdgeLengthAvg, latLngToCell };
