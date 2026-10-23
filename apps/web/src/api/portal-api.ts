// The calls the portal makes, one per operation of the contract. Each resolves to the answer's
// data or throws a PortalError (client.ts `unwrap`). Rename and delete of activities are not here
// on purpose: they stay on the phone (a web delete would become a tombstone the phone applies).
import { type PortalClient, unwrap } from './client';
import type {
  ActivityDetail,
  ActivityList,
  ActivityListQuery,
  ActivityTotals,
  ActivityType,
  SessionScope,
  Track,
} from './schema';

export type { SessionScope };

/** One page of the activity list: its size, the previous page's `nextCursor`, the type filter. */
export type ActivityPageRequest = { limit: number; cursor: string | null; type: ActivityType | null };

/** The list query as the contract takes it: no empty `cursor` or `type`. */
export function activityListQuery({ limit, cursor, type }: ActivityPageRequest): ActivityListQuery {
  return { limit, ...(cursor ? { cursor } : {}), ...(type ? { type } : {}) };
}

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
    // Activity history: reads only (H3). The ids are the phone's opaque ids, never a coordinate.
    // openapi-fetch's response mapping widens the contract's tuples (`LonLat`, `TrackPoint`) to
    // plain arrays, so these name the generated schema types (schema.ts) instead.
    activities: (page: ActivityPageRequest) =>
      unwrap(client.GET('/v1/activities', { params: { query: activityListQuery(page) } })) as Promise<ActivityList>,
    activity: (activityId: string) =>
      unwrap(
        client.GET('/v1/activities/{activityId}', { params: { path: { activityId } } })
      ) as Promise<ActivityDetail>,
    track: (activityId: string) =>
      unwrap(client.GET('/v1/activities/{activityId}/track', { params: { path: { activityId } } })) as Promise<Track>,
    activityTotals: () => unwrap(client.GET('/v1/activity-totals')) as Promise<ActivityTotals>,
  };
}

export type PortalApi = ReturnType<typeof portalApi>;
