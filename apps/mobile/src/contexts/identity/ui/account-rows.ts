import type { User } from '@/contexts/identity';
import { formatDay } from '@/ui-kit/format';

import { type AccountSettingsState, VALUE } from './account-settings.constants';

export interface AccountRow {
  value: string;
  /** Opens its flow (false: shown, not pressable now). */
  enabled: boolean;
}

export interface AccountRows {
  /** A local profile (mock admin, demo): no email or password to change. */
  local: boolean;
  name: AccountRow;
  email: AccountRow;
  password: AccountRow;
  signIn: string;
  /** "Try again" is offered (offline, or the server didn't answer). */
  retry: boolean;
}

/** What the editable rows say when the server can't be asked; null: it can (or is being asked). */
function blockedValue(state: AccountSettingsState): string | null {
  if (state.status === 'offline') {
    return VALUE.needsInternet;
  }
  if (state.status === 'failed') {
    return state.reason === 'auth' || state.reason === 'not-signed-in' ? VALUE.signInAgain : VALUE.couldNotLoad;
  }
  return null;
}

/**
 * Me › Account's rows from the signed-in user and the server's answer. An account's rows open only
 * once the server answered (online only, nothing queued); a local profile edits its name only.
 */
export function accountRows(user: User, state: AccountSettingsState): AccountRows {
  const settings = state.status === 'ready' ? state.settings : null;
  const local = settings ? settings.kind === 'local' : user.accountId == null;
  const account = settings?.kind === 'account' ? settings : null;
  const blocked = blockedValue(state);
  const name = (settings ? settings.name : user.name) || VALUE.notSet;
  if (local) {
    return {
      local,
      name: { value: name, enabled: true },
      email: { value: VALUE.createAccount, enabled: false },
      password: { value: VALUE.createAccount, enabled: false },
      signIn: VALUE.localProfile,
      retry: false,
    };
  }
  const password = !account
    ? VALUE.checking
    : !account.hasPassword
      ? VALUE.notSet
      : account.passwordChangedAt
        ? VALUE.setOn(formatDay(account.passwordChangedAt))
        : VALUE.set;
  return {
    local,
    name: { value: blocked ?? name, enabled: account != null },
    email: { value: blocked ?? account?.email ?? user.email, enabled: account != null },
    password: { value: blocked ?? password, enabled: account != null },
    signIn: account?.hasPassword ? VALUE.codeAndPassword : VALUE.codeOnly,
    retry: blocked != null,
  };
}
