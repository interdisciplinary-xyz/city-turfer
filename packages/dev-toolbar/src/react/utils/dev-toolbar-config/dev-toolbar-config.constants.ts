import type { DevStorageKeys } from '../../../protocol.js';

/** What the toolbar's non-React helpers need from the host app. */
export type DevToolbarRuntimeConfig = {
  /** Namespaced browser storage keys (see `createDevStorageKeys`). */
  storageKeys: DevStorageKeys;
  /** Every locale that appears as a URL prefix (all but the default one). */
  localePrefixes: readonly string[];
};

export type ConfigureDevToolbarOptions = {
  storagePrefix: string;
  locales: readonly string[];
  defaultLocale: string;
};
