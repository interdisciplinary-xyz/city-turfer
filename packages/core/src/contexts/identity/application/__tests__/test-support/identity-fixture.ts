import type { AccountProfiles } from '../../../domain/account-profiles';
import { type User, type UserId, userId } from '../../../domain/user';
import { createIdentityApi } from '../../../index';
import type {
  AccountDetails,
  AccountFailure,
  AccountGateway,
  AccountProfileStore,
  AccountSession,
  AuthGateway,
  CredentialStore,
  ProfileNameStore,
  SessionStore,
} from '../../ports';

export const ADMIN: User = { id: userId('admin'), email: 'admin@cityturfer.com', displayName: 'Admin' };

export const DEMO: User = { id: userId('demo'), email: 'demo@cityturfer.com', displayName: 'Ola' };

export const localAuth: AuthGateway = {
  signIn: async (e, p) =>
    e.value === ADMIN.email && p === 'admin1234'
      ? { kind: 'signed-in', user: ADMIN }
      : e.value === DEMO.email && p === 'demo1234'
        ? { kind: 'signed-in', user: DEMO }
        : { kind: 'invalid-credentials' },
  userById: async (id) => (id === 'admin' ? ADMIN : id === 'demo' ? DEMO : null),
  hasLocalAccount: (e) => e.value === ADMIN.email || e.value === 'demo@cityturfer.com',
};

/** The step-up code the fake mails to the current address, and the one it mails to a new address. */
export const STEP_UP_CODE = '111111';
export const NEW_INBOX_CODE = '222222';

interface FakeAccount {
  email: string;
  name: string | null;
  password: string | null;
  passwordChangedAt: number | null;
}

/**
 * The account server in memory: sign-in code 000000 works for any email; one account per email.
 * Account settings follow contract 0.5.0: step-up codes are single use, the new inbox gets its own
 * code, `email.taken` only after that code, `password.breached` for "password1234".
 */
export class FakeAccounts implements AccountGateway {
  readonly calls: string[] = [];
  readonly revoked: string[] = [];
  readonly deleted: string[] = [];
  fail: AccountFailure | null = null;
  private n = 0;
  private readonly ids = new Map<string, string>();
  readonly accounts = new Map<string, FakeAccount>();
  private readonly tokens = new Map<string, string>();
  private readonly stepUp = new Map<string, string>();
  private readonly emailChange = new Map<string, { newEmail: string; code: string }>();

  async requestCode(email: { value: string }) {
    this.calls.push(`code ${email.value}`);
    return this.fail ?? { kind: 'sent' as const };
  }
  async verifyCode(email: { value: string }, code: string) {
    this.calls.push(`verify ${email.value}`);
    if (this.fail) {
      return this.fail;
    }
    if (code !== '000000') {
      return { kind: 'invalid-code' as const };
    }
    return { kind: 'verified' as const, session: this.session(email.value) };
  }
  async revoke(token: string) {
    if (this.fail) {
      return this.fail;
    }
    this.revoked.push(token);
    return { kind: 'revoked' as const };
  }
  async deleteAccount(token: string) {
    if (this.fail) {
      return this.fail;
    }
    this.deleted.push(token);
    for (const [email, id] of this.ids) {
      if (token.startsWith(`tok-${id}-`)) {
        this.ids.delete(email);
      }
    }
    return { kind: 'deleted' as const };
  }
  async requestExport() {
    return this.fail ?? { kind: 'requested' as const };
  }

  async fetchMe(token: string) {
    this.calls.push('me');
    const a = this.fail ? null : this.byToken(token);
    if (!a) {
      return this.fail ?? { kind: 'auth' as const };
    }
    const me: AccountDetails = {
      id: this.tokens.get(token)!,
      email: a.email,
      name: a.name,
      hasPassword: a.password !== null,
      passwordChangedAt: a.passwordChangedAt,
    };
    return { kind: 'me' as const, me };
  }
  async updateName(token: string, name: string | null) {
    this.calls.push('name');
    const a = this.fail ? null : this.byToken(token);
    if (!a) {
      return this.fail ?? { kind: 'auth' as const };
    }
    a.name = name;
    return { kind: 'saved' as const, name };
  }
  async requestStepUpCode(token: string) {
    this.calls.push('step-up');
    const a = this.fail ? null : this.byToken(token);
    if (!a) {
      return this.fail ?? { kind: 'auth' as const };
    }
    this.stepUp.set(this.tokens.get(token)!, STEP_UP_CODE);
    return { kind: 'sent' as const };
  }
  async requestEmailChange(token: string, newEmail: string, stepUpCode: string) {
    this.calls.push(`email-code ${newEmail}`);
    const a = this.fail ? null : this.byToken(token);
    if (!a) {
      return this.fail ?? { kind: 'auth' as const };
    }
    if (!this.spend(token, stepUpCode)) {
      return { kind: 'invalid-code' as const };
    }
    this.emailChange.set(this.tokens.get(token)!, { newEmail, code: NEW_INBOX_CODE });
    return { kind: 'sent' as const };
  }
  async confirmEmailChange(token: string, newEmail: string, code: string) {
    this.calls.push(`email ${newEmail}`);
    const a = this.fail ? null : this.byToken(token);
    if (!a) {
      return this.fail ?? { kind: 'auth' as const };
    }
    const id = this.tokens.get(token)!;
    const pending = this.emailChange.get(id);
    if (!pending || pending.newEmail !== newEmail || pending.code !== code) {
      return { kind: 'invalid-code' as const };
    }
    this.emailChange.delete(id);
    if (this.ids.has(newEmail)) {
      return { kind: 'email-taken' as const };
    }
    this.ids.delete(a.email);
    this.ids.set(newEmail, id);
    a.email = newEmail;
    return { kind: 'changed' as const, email: newEmail };
  }
  async setPassword(token: string, newPassword: string, stepUpCode: string) {
    this.calls.push('password');
    const a = this.fail ? null : this.byToken(token);
    if (!a) {
      return this.fail ?? { kind: 'auth' as const };
    }
    if (!this.spend(token, stepUpCode)) {
      return { kind: 'invalid-code' as const };
    }
    if (newPassword === 'password1234') {
      return { kind: 'breached' as const };
    }
    a.password = newPassword;
    a.passwordChangedAt = 1_760_000_000_000;
    return { kind: 'saved' as const };
  }
  async removePassword(token: string, stepUpCode: string) {
    this.calls.push('remove-password');
    const a = this.fail ? null : this.byToken(token);
    if (!a) {
      return this.fail ?? { kind: 'auth' as const };
    }
    if (!this.spend(token, stepUpCode)) {
      return { kind: 'invalid-code' as const };
    }
    a.password = null;
    a.passwordChangedAt = null;
    return { kind: 'removed' as const };
  }
  async signInWithPassword(email: { value: string }, password: string) {
    this.calls.push(`password-sign-in ${email.value}`);
    if (this.fail) {
      return this.fail;
    }
    const id = this.ids.get(email.value);
    const a = id ? this.accounts.get(id) : undefined;
    if (!a || a.password === null || a.password !== password) {
      return { kind: 'invalid-credentials' as const };
    }
    return { kind: 'verified' as const, session: this.session(email.value) };
  }

  private session(email: string): AccountSession {
    const id = this.ids.get(email) ?? `u${++this.n}`;
    this.ids.set(email, id);
    if (!this.accounts.has(id)) {
      this.accounts.set(id, { email, name: null, password: null, passwordChangedAt: null });
    }
    const token = `tok-${id}-${this.n}`;
    this.tokens.set(token, id);
    return { token, expiresAt: 9e15, account: { id, email } };
  }
  private byToken(token: string): FakeAccount | null {
    const id = this.tokens.get(token);
    return id ? (this.accounts.get(id) ?? null) : null;
  }
  /** A step-up code works once. */
  private spend(token: string, code: string): boolean {
    const id = this.tokens.get(token)!;
    const ok = this.stepUp.get(id) === code;
    if (ok) {
      this.stepUp.delete(id);
    }
    return ok;
  }
}

export function setup(
  opts: {
    adminHasHistory?: boolean;
    profiles?: ReturnType<AccountProfiles['toState']>;
    names?: boolean;
    /** Another phone talking to the same server. */
    gateway?: FakeAccounts;
  } = {}
) {
  let session: UserId | null = null;
  let credentials: AccountSession | null = null;
  let profiles: ReturnType<AccountProfiles['toState']> | null = opts.profiles ?? null;
  let recording = false;
  let keychainBroken = false;
  const names = new Map<string, string | null>();
  const sessions: SessionStore = {
    read: async () => session,
    write: async (id) => void (session = id),
    clear: async () => void (session = null),
  };
  const credentialStore: CredentialStore = {
    read: async () => credentials,
    save: async (s) => {
      if (keychainBroken) {
        throw new Error('keychain write failed');
      }
      credentials = s;
    },
    clear: async () => void (credentials = null),
  };
  const profileStore: AccountProfileStore = {
    read: async () => profiles,
    write: async (s) => void (profiles = s),
  };
  const nameStore: ProfileNameStore = {
    read: async (id) => (names.has(id) ? names.get(id) : undefined),
    write: async (id, name) => void names.set(id, name),
  };
  const gateway = opts.gateway ?? new FakeAccounts();
  const history = { asked: 0 };
  const api = createIdentityApi(
    {
      auth: localAuth,
      sessions,
      accounts: {
        gateway,
        credentials: credentialStore,
        profiles: profileStore,
        history: {
          hasActivities: async (id) => {
            history.asked++;
            return id === 'admin' && (opts.adminHasHistory ?? false);
          },
        },
      },
      ...(opts.names ? { names: nameStore } : {}),
    },
    async () => recording
  );
  return {
    api,
    gateway,
    history,
    names,
    session: () => session,
    credentials: () => credentials,
    profiles: () => profiles,
    setRecording: (r: boolean) => void (recording = r),
    /** Simulates a lost write of the profile map (e.g. the keychain failed mid sign-in). */
    forgetProfiles: () => void (profiles = null),
    /** Simulates a keychain that lost the session (e.g. a restored iPhone). */
    forgetCredentials: () => void (credentials = null),
    /** Simulates a keychain that refuses writes (reads still work). */
    breakKeychain: (broken = true) => void (keychainBroken = broken),
  };
}
