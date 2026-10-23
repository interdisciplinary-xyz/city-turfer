import enCommon from '../../messages/en/common.json';
import plCommon from '../../messages/pl/common.json';
import { DEFAULT_LOCALE, type Locale, LOCALES } from './locales';

/*
 * The message catalogue: apps/mobile/messages/<locale>/<namespace>.json (L5). Metro bundles only
 * static imports, so every file is listed here; a new namespace is one line per locale. English is
 * the source: its shape types the keys (`useT('common')('cancel')`).
 */
const SOURCE = { common: enCommon };
export type Messages = typeof SOURCE;
export type Namespace = keyof Messages;

type Catalogue = { [N in Namespace]: Record<string, unknown> };
const RAW: Record<Locale, Catalogue> = {
  en: SOURCE,
  pl: { common: plCommon },
};

type Tree = { [key: string]: string | Tree };
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `base` with every message `over` has replaced; keys only `base` has stay (the English fallback). */
function overlay(base: Tree, over: unknown, path: string, missing: string[]): Tree {
  const out: Tree = {};
  for (const [k, v] of Object.entries(base)) {
    const o = isTree(over) ? over[k] : undefined;
    if (isTree(v)) {
      out[k] = overlay(v, o, `${path}.${k}`, missing);
    } else if (typeof o === 'string' && o !== '') {
      out[k] = o;
    } else {
      out[k] = v;
      missing.push(`${path}.${k}`);
    }
  }
  return out;
}

/**
 * Every locale's messages with English under them, built once: a key a locale lacks shows the
 * English message (formatted with its values) instead of a raw key. audit:i18n keeps this empty
 * in CI; in development the gaps are reported once at launch.
 */
export const MESSAGES: Record<Locale, Messages> = Object.fromEntries(
  LOCALES.map((locale) => {
    const missing: string[] = [];
    const merged = Object.fromEntries(
      Object.entries(SOURCE).map(([ns, base]) => [ns, overlay(base as Tree, RAW[locale][ns as Namespace], ns, missing)])
    );
    if (__DEV__ && locale !== DEFAULT_LOCALE && missing.length > 0) {
      console.warn(`[i18n] ${locale} lacks ${missing.length} message(s), showing English: ${missing.join(', ')}`);
    }
    return [locale, merged];
  })
) as unknown as Record<Locale, Messages>;

/** The English text of `namespace.key` (dotted), or undefined. */
export function sourceMessage(path: string): string | undefined {
  let node: unknown = SOURCE;
  for (const part of path.split('.')) {
    node = isTree(node) ? node[part] : undefined;
  }
  return typeof node === 'string' ? node : undefined;
}
