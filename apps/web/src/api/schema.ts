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
