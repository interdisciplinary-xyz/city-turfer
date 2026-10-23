import type { PortalError } from '@/api/errors';
import type { AuthSession, SessionScope } from '@/api/schema';

export type DevicesPending = { id: string } | { scope: SessionScope } | null;

export type DevicesPanelProps = {
  /** The account's sessions, or null when the list can't be had (an older API). */
  sessions: readonly AuthSession[] | null;
  loading: boolean;
  locale: string;
  onRevoke: (id: string) => void;
  onRevokeScope: (scope: SessionScope) => void;
  pending: DevicesPending;
  error: PortalError | null;
  /** Start with a confirmation open, for stories. */
  initialConfirm?: SessionScope | null;
};

/** This browser first, then the most recently used. */
export function sortSessions(sessions: readonly AuthSession[]): AuthSession[] {
  return [...sessions].sort((a, b) =>
    a.current === b.current ? b.lastActiveAt.localeCompare(a.lastActiveAt) : a.current ? -1 : 1
  );
}
