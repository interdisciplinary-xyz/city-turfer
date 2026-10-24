// Named aliases of the generated contract (schema.gen.ts, from apps/api/openapi.json via
// `pnpm --filter @cityturfer/web run api:types`). Never hand-write a request or response type: add
// an alias here and let `tsc` show what a spec change broke.
import type { components, paths } from './schema.gen';

type Schemas = components['schemas'];

export type ApiPaths = paths;
export type User = Schemas['User'];
export type Consent = Schemas['Consent'];
export type ConsentPurpose = Schemas['ConsentPurpose'];
export type DataExportJob = Schemas['DataExportJob'];
export type ProblemCode = Schemas['ProblemCode'];
export type Problem = Schemas['Problem'];
export type SignInBody = Schemas['SignInBody'];

/** `GET /v1/auth/sessions` (contract 0.5.0): every signed-in phone and browser of the account. */
export type SessionList = ApiPaths['/v1/auth/sessions']['get']['responses'][200]['content']['application/json'];
export type AuthSession = SessionList['sessions'][number];
/** `DELETE /v1/auth/sessions?scope=`: `others` keeps this browser, `all` signs out everywhere, phones too. */
export type SessionScope = ApiPaths['/v1/auth/sessions']['delete']['parameters']['query']['scope'];

/** Activity history (contract 0.6.0, docs/plans/web-portal-history-2026-10-23.md). */
export type ActivityType = Schemas['ActivityType'];
export type ActivitySource = Schemas['ActivitySource'];
export type ActivityList = Schemas['ActivityList'];
export type ActivitySummary = Schemas['ActivitySummary'];
export type ActivityDetail = Schemas['ActivityDetail'];
export type ActivityTotals = Schemas['ActivityTotals'];
/** What a phone uploads (`PUT /v1/activities/{id}`); the portal never does: only its E2E seeds with it. */
export type ActivityUpload = Schemas['ActivityUpload'];
export type Totals = Schemas['Totals'];
export type Track = Schemas['Track'];
export type TrackPoint = Schemas['TrackPoint'];
export type GapRoute = Schemas['GapRoute'];
export type Split = Schemas['Split'];
export type LonLat = Schemas['LonLat'];
/** The query of `GET /v1/activities`: page size, cursor and type filter. */
export type ActivityListQuery = NonNullable<ApiPaths['/v1/activities']['get']['parameters']['query']>;
