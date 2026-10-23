import type { T } from '@/i18n';
import { DomainError } from '@/shared-kernel';

import type { ImportReport } from '../contract';

/** The `health` messages an Apple Health failure can show; never the error's own text. */
export type HealthErrorKey = 'errors.unavailable' | 'errors.generic';

/** Error codes the card explains; anything else (HealthKit, SQLite) gets the generic message. */
const ERROR_KEY_OF_CODE: Record<string, HealthErrorKey> = { 'health.unavailable': 'errors.unavailable' };

/** "12 workouts added · 2 already in CityTurfer · 3 without a route" — the last import, in words. */
export function describeImport(r: ImportReport, t: T<'health'>): string {
  const parts = [t('report.imported', { count: r.imported })];
  if (r.duplicates > 0) {
    parts.push(t('report.duplicates', { count: r.duplicates }));
  }
  if (r.withoutRoute > 0) {
    parts.push(t('report.withoutRoute', { count: r.withoutRoute }));
  }
  return parts.join(' · ');
}

/** Which message explains `e` to the Turfer: known Health Sync codes, else the generic one. */
export function healthErrorKey(e: unknown): HealthErrorKey {
  return (e instanceof DomainError && ERROR_KEY_OF_CODE[e.code]) || 'errors.generic';
}
