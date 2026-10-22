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
 * The credentials live in this file only; replace this adapter with a real
 * provider by adding another AuthGateway and wiring it in the composition root.
 */
const ACCOUNTS: readonly { password: string; user: User }[] = [
  { password: 'admin1234', user: { id: userId('admin'), email: 'admin@cityturfer.com', displayName: 'Admin' } },
  { password: 'demo1234', user: { id: userId('demo'), email: 'demo@cityturfer.com', displayName: 'Ola' } },
];

export class MockAuthGateway implements AuthGateway {
  async signIn(email: Email, password: string): Promise<SignInOutcome> {
    const account = ACCOUNTS.find((a) => a.user.email === email.value && a.password === password);
    return account ? { kind: 'signed-in', user: account.user } : { kind: 'invalid-credentials' };
  }
  async userById(id: UserId): Promise<User | null> {
    return ACCOUNTS.find((a) => a.user.id === id)?.user ?? null;
  }
}
