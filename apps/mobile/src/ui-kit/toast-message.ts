import { type Locale, type Namespace, translator } from '@/i18n';

import type { MessageRef } from './toast-provider.constants';

/**
 * A toast's words in the app language (`locale` for tests). Keys are `<namespace>.<key>`;
 * namespaces never contain a dot (`mobile-i18n` skill), so the first segment is the namespace.
 */
export function wordMessage(ref: MessageRef, locale?: Locale): string {
  const { key, values } = typeof ref === 'string' ? { key: ref, values: undefined } : ref;
  const dot = key.indexOf('.');
  const t = translator(key.slice(0, dot) as Namespace, locale) as unknown as (
    k: string,
    v?: Record<string, string | number>
  ) => string;
  return t(key.slice(dot + 1), values);
}
