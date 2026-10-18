import { createDevStorageKeys, DEFAULT_DEV_STORAGE_PREFIX } from '../../../protocol.js';
import type { ConfigureDevToolbarOptions, DevToolbarRuntimeConfig } from './dev-toolbar-config.constants';

let config: DevToolbarRuntimeConfig = {
  storageKeys: createDevStorageKeys(DEFAULT_DEV_STORAGE_PREFIX),
  localePrefixes: [],
};

/**
 * Inject the host app's values (plan R8) into the toolbar's module-level
 * helpers — the storage readers/writers and the route-inventory loader run
 * outside React, so a context can't reach them. `DevToolbar` calls this at
 * the top of every render, before any of its hooks or children read it.
 * Idempotent: the same props always produce the same config.
 *
 * Single-instance: the config is module-level state, so if more than one
 * `DevToolbar` were mounted the last one to render would win. The toolbar is
 * mounted once per app root; don't mount two with different props.
 */
export function configureDevToolbar({ storagePrefix, locales, defaultLocale }: ConfigureDevToolbarOptions): void {
  config = {
    storageKeys: createDevStorageKeys(storagePrefix),
    localePrefixes: locales.filter((locale) => locale !== defaultLocale),
  };
}

export const getDevToolbarConfig = (): DevToolbarRuntimeConfig => config;
