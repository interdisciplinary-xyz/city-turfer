'use client';

// Data hooks of the portal (TanStack Query, in memory only). Pages use these, never the client.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useContext } from 'react';

import { deleteAccountMutation, revokeSessionsMutation, SESSIONS_KEY, signOutMutation } from './account-mutations';
import type { PortalError } from './errors';
import { PortalApiContext, type PortalApiContextValue } from './provider.constants';

/** Polls an export while it is being built, for at most this long (ms) per page visit. */
export const EXPORT_POLL_MS = 3_000;

export const QUERY_KEYS = {
  me: ['me'],
  consents: ['consents'],
  sessions: SESSIONS_KEY,
  export: (id: string) => ['export', id],
} as const;

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

export function useConsents({ enabled = true }: { enabled?: boolean } = {}) {
  const { api } = usePortal();
  return useQuery<Awaited<ReturnType<typeof api.consents>>, PortalError>({
    queryKey: QUERY_KEYS.consents,
    queryFn: api.consents,
    enabled,
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
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? EXPORT_POLL_MS : false),
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
