/** Where ./hide-text-decoder.ts stashes the real TextDecoder until ./h3.ts restores it. */
export const SAVED_TEXT_DECODER = Symbol.for('@cityturfer/core/h3:saved-TextDecoder');
