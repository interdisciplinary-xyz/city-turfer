/**
 * The phone's Account tab in the sync chain: the account settings calls go through the app's own
 * ApiAuthGateway (the adapter the Account tab's use cases call), with the phone's session token.
 * Only `missing()` reads the API directly, to tell "not on this API" (pending) from a failure.
 */
import type { ApiAuthGateway } from '@/contexts/identity/infrastructure/api-auth-gateway';

import type { Pending } from './pending';
import { retryAfterWait } from './retry';

export interface AccountActions {
  /**
   * Null when this API has account settings; pending when `/v1/me` answers without them. Throws on
   * any other answer (a refused session or a server error is a failure, not "not built yet").
   */
  missing(): Promise<Pending | null>;
  me: () => ReturnType<ApiAuthGateway['fetchMe']>;
  /** A blank name clears it. */
  rename: (name: string) => ReturnType<ApiAuthGateway['updateName']>;
  /** Mails a step-up code to the current address (the fixed code for test addresses). */
  requestStepUpCode: () => ReturnType<ApiAuthGateway['requestStepUpCode']>;
  requestEmailChange: (newEmail: string, stepUpCode: string) => ReturnType<ApiAuthGateway['requestEmailChange']>;
  confirmEmailChange: (newEmail: string, code: string) => ReturnType<ApiAuthGateway['confirmEmailChange']>;
  setPassword: (newPassword: string, stepUpCode: string) => ReturnType<ApiAuthGateway['setPassword']>;
}

export function accountActions(
  gateway: ApiAuthGateway,
  token: string,
  read: (path: string) => Promise<Response>
): AccountActions {
  return {
    async missing() {
      const res = await read('/v1/me');
      if (res.status !== 200) {
        throw new Error(`GET /v1/me → ${res.status}: the session or the API failed`);
      }
      const me = (await res.json()) as Record<string, unknown>;
      return 'hasPassword' in me
        ? null
        : { pending: 'account settings are not on this API (GET /v1/me has no hasPassword)' };
    },
    me: () => gateway.fetchMe(token),
    rename: (name) => gateway.updateName(token, name),
    // One code per address per minute: wait it out like a user would.
    requestStepUpCode: () => retryAfterWait(() => gateway.requestStepUpCode(token)),
    requestEmailChange: (newEmail, stepUpCode) =>
      retryAfterWait(() => gateway.requestEmailChange(token, newEmail, stepUpCode)),
    confirmEmailChange: (newEmail, code) => gateway.confirmEmailChange(token, newEmail, code),
    setPassword: (newPassword, stepUpCode) => gateway.setPassword(token, newPassword, stepUpCode),
  };
}
