import type { PortalError } from '@/api/errors';
import type { Locale } from '@/i18n/routing';

export type ActivityPageProps = { locale: Locale };

/** What the detail page shows for its `?id=` and the detail query. */
export type ActivityView =
  | { kind: 'to-list' }
  | { kind: 'not-found' }
  | { kind: 'deleted' }
  | { kind: 'loading' }
  | { kind: 'unreachable'; error: PortalError }
  | { kind: 'error'; error: PortalError }
  | { kind: 'leaving' }
  | { kind: 'activity' };

/**
 * No id → back to the list; an id the contract can't hold, or a 404 (deleted for good, or not this
 * user's: the API doesn't tell them apart) → "not found"; a 410 → "deleted on your phone".
 */
export function activityView({
  rawId,
  validId,
  hasData,
  error,
}: {
  rawId: string | null;
  validId: boolean;
  hasData: boolean;
  error: PortalError | null;
}): ActivityView {
  if (rawId === null || rawId === '') {
    return { kind: 'to-list' };
  }
  if (!validId) {
    return { kind: 'not-found' };
  }
  if (error?.code === 'signed-out') {
    return { kind: 'leaving' };
  }
  if (hasData) {
    return { kind: 'activity' };
  }
  if (error?.code === 'not-found') {
    return { kind: 'not-found' };
  }
  if (error?.code === 'activity.deleted') {
    return { kind: 'deleted' };
  }
  if (error) {
    return error.unreachable ? { kind: 'unreachable', error } : { kind: 'error', error };
  }
  return { kind: 'loading' };
}
