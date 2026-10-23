/**
 * The admin portal in the sync chain. apps/admin holds only staff accounts in its own database; it
 * will read user data through the API's audited `/internal/admin/v1` routes (admin lane D,
 * docs/plans/sync-chain-testing-2026-10-22.md N4), which don't exist yet. Until they do, there is
 * nothing a phone change can show there, and every admin check reports pending.
 *
 * The probe turns into a failure the day those routes appear, so the admin observer gets written
 * instead of the checks staying pending by accident.
 */
import type { Pending } from './pending';

/** A route the admin lane will add; any answer but 404 means the prefix exists. */
const PROBE = '/internal/admin/v1/users/chain-probe';

export async function adminObserver(base: string): Promise<Pending> {
  const res = await fetch(`${base}${PROBE}`);
  if (res.status === 404) {
    return { pending: 'no /internal/admin/v1 routes on this API yet (admin lane D): nothing to observe' };
  }
  throw new Error(
    `GET ${PROBE} → ${res.status}: the admin routes exist now. Write the admin observer ` +
      '(counts, an audit row per staff read, never a coordinate) and replace this probe.'
  );
}
