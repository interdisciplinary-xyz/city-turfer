// The calls the portal makes, one per operation of the contract. Each resolves to the answer's
// data or throws a PortalError (client.ts `unwrap`). Rename and delete of activities are not here
// on purpose: they stay on the phone (a web delete would become a tombstone the phone applies).
import { type PortalClient, unwrap } from './client';
import type { SessionScope } from './schema';

export type { SessionScope };

export function portalApi(client: PortalClient) {
  return {
    requestCode: (email: string) => unwrap(client.POST('/v1/auth/codes', { body: { email } })),
    signIn: (email: string, code: string, sharedComputer: boolean) =>
      unwrap(client.POST('/v1/auth/sign-in', { body: { email, code, client: 'browser', sharedComputer } })),
    signOut: () => unwrap(client.DELETE('/v1/auth/session')),
    me: () => unwrap(client.GET('/v1/me')),
    consents: () => unwrap(client.GET('/v1/me/consents')),
    requestExport: () => unwrap(client.POST('/v1/me/exports')),
    exportStatus: (exportId: string) =>
      unwrap(client.GET('/v1/me/exports/{exportId}', { params: { path: { exportId } } })),
    deleteAccount: () => unwrap(client.DELETE('/v1/me')),
    sessions: () => unwrap(client.GET('/v1/auth/sessions')),
    revokeSession: (sessionId: string) =>
      unwrap(client.DELETE('/v1/auth/sessions/{sessionId}', { params: { path: { sessionId } } })),
    revokeSessions: (scope: SessionScope) =>
      unwrap(client.DELETE('/v1/auth/sessions', { params: { query: { scope } } })),
  };
}

export type PortalApi = ReturnType<typeof portalApi>;
