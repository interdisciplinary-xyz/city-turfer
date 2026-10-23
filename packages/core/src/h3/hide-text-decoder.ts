/**
 * Side-effect module, imported by ./h3.ts right before h3-js. h3-js evaluates
 * `new TextDecoder("utf-16le")` at module load whenever TextDecoder exists; Hermes' TextDecoder
 * only supports UTF-8 and throws RangeError. h3-js falls back to its own decoder when
 * TextDecoder is undefined, so hide it until ./h3.ts has loaded h3-js and puts it back.
 *
 * Kept as a bare `import './hide-text-decoder'` on purpose: side-effect imports are evaluated in
 * source order by native ESM, esbuild, and Babel's CommonJS transform (Metro, Jest), and are
 * never made lazy, so this always runs before h3-js.
 */
import { SAVED_TEXT_DECODER } from './text-decoder.constants';

const g = globalThis as Record<PropertyKey, unknown>;
g[SAVED_TEXT_DECODER] = { value: g.TextDecoder };
g.TextDecoder = undefined;
