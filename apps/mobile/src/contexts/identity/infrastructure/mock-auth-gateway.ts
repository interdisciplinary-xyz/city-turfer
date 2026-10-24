import {
  type AuthGateway,
  type Email,
  type SignInOutcome,
  type User,
  type UserId,
  userId,
} from '@cityturfer/core/identity/ports';

/**
 * PoC-only authentication (docs/poc-plan.md §4.0, §9). Two fixed accounts:
 * the admin, and a demo account whose first sign-in fills its own database
 * with Gdańsk demo data for screenshots (src/dev/gdansk-demo.ts).
 * The credentials live in this file only. Real accounts (email one-time codes)
 * go through ApiAuthGateway; these two local profiles keep working in every build.
 * `name` is the default; a name the Turfer chooses in Me › Account is kept on the phone
 * (ProfileNameStore) and wins. Local profiles have no email to change and no account password.
 */
export interface MockAccount {
  readonly password: string;
  readonly user: User;
}

const ACCOUNTS: readonly MockAccount[] = [
  {
    password: 'admin1234',
    user: { id: userId('admin'), email: 'admin@cityturfer.com', displayName: 'Admin', name: 'Admin' },
  },
  { password: 'demo1234', user: { id: userId('demo'), email: 'demo@cityturfer.com', displayName: 'Ola', name: 'Ola' } },
];

export class MockAuthGateway implements AuthGateway {
  /** `accounts`: the local profiles (tests); default the mock admin and the demo profile. */
  constructor(private readonly accounts: readonly MockAccount[] = ACCOUNTS) {}

  async signIn(email: Email, password: string): Promise<SignInOutcome> {
    const account = this.accounts.find((a) => a.user.email === email.value && a.password === password);
    return account ? { kind: 'signed-in', user: account.user } : { kind: 'invalid-credentials' };
  }
  async userById(id: UserId): Promise<User | null> {
    return this.accounts.find((a) => a.user.id === id)?.user ?? null;
  }
  /** These emails sign in with their password in every build; any other email gets a code. */
  localProfileOf(email: Email): UserId | null {
    return this.accounts.find((a) => a.user.email === email.value)?.user.id ?? null;
  }
  /** The profile's own address: where its backup link code goes (Info › Cloud backup). */
  localEmailOf(profileId: string): Email | null {
    const user = this.accounts.find((a) => a.user.id === profileId)?.user;
    return user ? { value: user.email } : null;
  }
}
