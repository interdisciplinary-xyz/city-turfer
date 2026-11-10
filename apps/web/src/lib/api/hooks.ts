'use client';

// Data hooks of the portal (TanStack Query, in memory only). Pages use these, never the client.
import { type InfiniteData, type QueryClient, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useContext } from 'react';

import { deleteAccountMutation, revokeSessionsMutation, SESSIONS_KEY, signOutMutation } from './account-mutations';
import { isActivityId } from './activity-id';
import type { PortalError } from './errors';
import { PortalApiContext, type PortalApiContextValue } from './provider.constants';
import type { ActivityType } from './schema';

/** Activities per page of the list (H6: cursor pages of 50, "Show more"). */
export const ACTIVITY_PAGE_SIZE = 50;

/**
 * The list is fresh for this long (ms) and isn't re-read on window focus: re-reading every loaded
 * page of 50 on each focus is heavy, and the session is still re-checked by `/v1/me` on focus.
 */
export const ACTIVITY_LIST_STALE_MS = 5 * 60_000;

/**
 * How often (ms) to re-read an export while its status is `pending`. An interval, with no cap: it
 * stops when the status changes or a read fails. Today `POST /v1/me/exports` builds the zip within
 * the request and answers `ready`, `failed` or `expired`, so this only runs if the API ever queues.
 */
export const EXPORT_POLL_MS = 3_000;

/** The `refetchInterval` of an export: poll while `pending`, never after an error. */
export function exportPollInterval(state: { status: string; data?: { status: string } }): number | false {
  if (state.status === 'error') {
    return false;
  }
  return state.data?.status === 'pending' ? EXPORT_POLL_MS : false;
}

export const QUERY_KEYS = {
  me: ['me'],
  consents: ['consents'],
  sessions: SESSIONS_KEY,
  export: (id: string) => ['export', id],
  /** Every list of activities, whatever the filter. */
  activityLists: ['activities'],
  activities: (type: ActivityType | null) => ['activities', type ?? 'all'],
  activity: (id: string) => ['activity', id],
  /** Every cached track of one activity, whatever its hash. */
  tracksOf: (id: string) => ['track', id],
  /** By id and the detail's `trackHash`: a re-upload (new hash) is a new track, never the old one. */
  track: (id: string, trackHash: string) => ['track', id, trackHash],
  activityTotals: ['activity-totals'],
  /** The backup state (activities-page `backupKey`) the cached lists were last shown under; no fetch. */
  historyBackup: ['history-backup'],
} as const;

/**
 * An activity the API says is gone (404, or 410 `activity.deleted`): drop what memory still holds
 * of it. Its track goes (every `trackHash`); the detail keeps its error but loses its data, without
 * a refetch (removing an observed query would fetch it again, and again).
 */
export function forgetActivity(queryClient: QueryClient, id: string): void {
  queryClient.removeQueries({ queryKey: QUERY_KEYS.tracksOf(id) });
  queryClient
    .getQueryCache()
    .find({ queryKey: QUERY_KEYS.activity(id), exact: true })
    ?.setState({ data: undefined, dataUpdatedAt: 0 });
}

export function usePortal(): PortalApiContextValue {
  const value = useContext(PortalApiContext);
  if (!value) {
    throw new Error('usePortal: render inside PortalApiProvider (the portal root layout)');
  }
  return value;
}

export function useMe() {
  const { api } = usePortal();
  return useQuery<Awaited<ReturnType<typeof api.me>>, PortalError>({ queryKey: QUERY_KEYS.me, queryFn: api.me });
}

/** The consents; `fresh`: always asked again when the page mounts, even if a cached answer is fresh. */
export function useConsents({ enabled = true, fresh = false }: { enabled?: boolean; fresh?: boolean } = {}) {
  const { api } = usePortal();
  return useQuery<Awaited<ReturnType<typeof api.consents>>, PortalError>({
    queryKey: QUERY_KEYS.consents,
    queryFn: api.consents,
    enabled,
    refetchOnMount: fresh ? 'always' : true,
  });
}

export function useSessions({ enabled = true }: { enabled?: boolean } = {}) {
  const { api } = usePortal();
  return useQuery<Awaited<ReturnType<typeof api.sessions>>, PortalError>({
    queryKey: QUERY_KEYS.sessions,
    queryFn: api.sessions,
    enabled,
  });
}

/** The status of an export this page asked for (its id lives only in memory). */
export function useExportStatus(exportId: string | null) {
  const { api } = usePortal();
  return useQuery<Awaited<ReturnType<typeof api.exportStatus>>, PortalError>({
    queryKey: QUERY_KEYS.export(exportId ?? ''),
    queryFn: () => api.exportStatus(exportId ?? ''),
    enabled: exportId !== null,
    refetchInterval: (query) => exportPollInterval(query.state),
  });
}

/**
 * The backed-up activities, newest first, one cursor page of `ACTIVITY_PAGE_SIZE` at a time
 * (`fetchNextPage` = "Show more"). The type filter is page state (H6), so each filter is its own list.
 */
export function useActivities(type: ActivityType | null) {
  const { api } = usePortal();
  type Page = Awaited<ReturnType<typeof api.activities>>;
  return useInfiniteQuery<Page, PortalError, InfiniteData<Page, string | null>, readonly string[], string | null>({
    queryKey: QUERY_KEYS.activities(type),
    queryFn: ({ pageParam }) => api.activities({ limit: ACTIVITY_PAGE_SIZE, cursor: pageParam, type }),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: ACTIVITY_LIST_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

/** All-time totals, all and per type (`GET /v1/activity-totals`). */
export function useActivityTotals() {
  const { api } = usePortal();
  return useQuery<Awaited<ReturnType<typeof api.activityTotals>>, PortalError>({
    queryKey: QUERY_KEYS.activityTotals,
    queryFn: api.activityTotals,
  });
}

/** One activity with its splits and gap routes; off until there is a valid id. */
export function useActivity(id: string | null) {
  const { api } = usePortal();
  return useQuery<Awaited<ReturnType<typeof api.activity>>, PortalError>({
    queryKey: QUERY_KEYS.activity(id ?? ''),
    queryFn: () => api.activity(id ?? ''),
    enabled: isActivityId(id),
  });
}

/**
 * Every point of one activity (up to 40,000), for its route shape; in memory only, like the rest.
 * Keyed by the detail's `trackHash` and off until it is known, so a re-uploaded track is read anew.
 */
export function useTrack(id: string | null, trackHash: string | null) {
  const { api } = usePortal();
  return useQuery<Awaited<ReturnType<typeof api.track>>, PortalError>({
    queryKey: QUERY_KEYS.track(id ?? '', trackHash ?? ''),
    queryFn: () => api.track(id ?? ''),
    enabled: isActivityId(id) && Boolean(trackHash),
    // The same hash is the same track: keep it while it's in memory.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useRequestCode() {
  const { api } = usePortal();
  return useMutation<unknown, PortalError, string>({ mutationFn: (email) => api.requestCode(email) });
}

export function useSignIn() {
  const { api, queryClient } = usePortal();
  return useMutation<unknown, PortalError, { email: string; code: string; sharedComputer: boolean }>({
    mutationFn: ({ email, code, sharedComputer }) => api.signIn(email, code, sharedComputer),
    // Nothing from an earlier visit may show up under the new session.
    onSuccess: () => queryClient.clear(),
  });
}

export function useSignOut() {
  const { api, leave } = usePortal();
  return useMutation(signOutMutation({ api, leave }));
}

export function useRequestExport() {
  const { api } = usePortal();
  return useMutation<Awaited<ReturnType<typeof api.requestExport>>, PortalError, void>({
    mutationFn: () => api.requestExport(),
  });
}

export function useDeleteAccount() {
  const { api, leave } = usePortal();
  return useMutation(deleteAccountMutation({ api, leave }));
}

export function useRevokeSession() {
  const { api, queryClient } = usePortal();
  return useMutation<unknown, PortalError, string>({
    mutationFn: (id) => api.revokeSession(id),
    // 404 too: that session had already signed out (or expired), so the list is stale either way.
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sessions }),
  });
}

export function useRevokeSessions() {
  const { api, queryClient, leave } = usePortal();
  return useMutation(revokeSessionsMutation({ api, leave, queryClient }));
}
