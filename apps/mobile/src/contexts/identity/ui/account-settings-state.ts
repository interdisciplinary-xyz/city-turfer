import { type AccountSettingsAnswer, type AccountSettingsState, failureText } from './account-settings.constants';

/**
 * Asking the server again: a `ready` answer becomes stale (rows that depend on `hasPassword` wait),
 * an offline or failed one shows that it is retrying. The first load stays `loading`.
 */
export function refreshStarted(state: AccountSettingsState): AccountSettingsState {
  switch (state.status) {
    case 'loading':
      return state;
    case 'ready':
      return { ...state, refreshing: true };
    default:
      return { ...state, retrying: true };
  }
}

/** The server's answer as what Me › Account shows. */
export function refreshAnswered(r: AccountSettingsAnswer): AccountSettingsState {
  if (r.kind === 'account' || r.kind === 'local') {
    return { status: 'ready', settings: r };
  }
  if (r.kind === 'offline') {
    return { status: 'offline' };
  }
  return { status: 'failed', reason: r.kind };
}

/**
 * Numbers requests so only the newest answer is used: a slow `offline` that lands after a newer
 * `ready` is dropped.
 */
export function latestRequest() {
  let last = 0;
  return {
    begin: (): number => ++last,
    isLatest: (id: number): boolean => id === last,
  };
}

/** Why an account flow can't open now (offline, or the server refused), in plain words; null: it can. */
export function unreachableText(state: AccountSettingsState): string | null {
  if (state.status === 'offline') {
    return failureText({ kind: 'offline' });
  }
  if (state.status === 'failed') {
    return failureText(
      state.reason === 'rate-limited' ? { kind: state.reason, retryAfterS: null } : { kind: state.reason }
    );
  }
  return null;
}
