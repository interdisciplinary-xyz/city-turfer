import type { User } from '@/contexts/identity';
import type { T } from '@/i18n';
import { formatDay } from '@/ui-kit/format';

import type { AccountSettingsState } from './account-settings.constants';

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
  /** "Try again" was tapped and the answer isn't back yet: it reads "Checking…" and is disabled. */
  retrying: boolean;
}

/** What the editable rows say when the server can't be asked; null: it can (or is being asked). */
function blockedValue(state: AccountSettingsState, t: T<'account'>): string | null {
  if ((state.status === 'offline' || state.status === 'failed') && state.retrying) {
    return t('value.checking');
  }
  if (state.status === 'offline') {
    return t('value.needsInternet');
  }
  if (state.status === 'failed') {
    return state.reason === 'auth' || state.reason === 'not-signed-in'
      ? t('value.signInAgain')
      : t('value.couldNotLoad');
  }
  return null;
}

/**
 * Me › Account's rows from the signed-in user and the server's answer. An account's rows open only
 * once the server answered (online only, nothing queued); a local profile edits its name only.
 * While a `ready` answer is being asked again, what depends on `hasPassword` (the password row and
 * the sign-in methods) reads "Checking…" and the password row stays closed until the fresh answer.
 * `t`: the `account` messages (`useT` in the component, `translator` in tests); `locale` for the date.
 */
export function accountRows(user: User, state: AccountSettingsState, t: T<'account'>, locale?: string): AccountRows {
  const settings = state.status === 'ready' ? state.settings : null;
  const local = settings ? settings.kind === 'local' : user.accountId == null;
  const account = settings?.kind === 'account' ? settings : null;
  const blocked = blockedValue(state, t);
  const name = (settings ? settings.name : user.name) || t('value.notSet');
  if (local) {
    return {
      local,
      name: { value: name, enabled: true },
      email: { value: t('value.createAccount'), enabled: false },
      password: { value: t('value.createAccount'), enabled: false },
      signIn: t('value.localProfile'),
      retry: false,
      retrying: false,
    };
  }
  const stale = state.status === 'ready' && state.refreshing === true;
  const password =
    !account || stale
      ? t('value.checking')
      : !account.hasPassword
        ? t('value.notSet')
        : account.passwordChangedAt
          ? t('value.setOn', { day: formatDay(account.passwordChangedAt, locale) })
          : t('value.set');
  return {
    local,
    name: { value: blocked ?? name, enabled: account != null },
    email: { value: blocked ?? account?.email ?? user.email, enabled: account != null },
    password: { value: blocked ?? password, enabled: account != null && !stale },
    signIn: stale ? t('value.checking') : account?.hasPassword ? t('value.codeAndPassword') : t('value.codeOnly'),
    retry: blocked != null,
    retrying: (state.status === 'offline' || state.status === 'failed') && state.retrying === true,
  };
}
