import type { AuthGateway, SignInOutcome } from '../application/ports';
import { type Email, type User, type UserId, userId } from '../domain/user';

/**
 * PoC-only authentication (docs/poc-plan.md §4.0, §9). Exactly one account.
 * The credentials live in this file only; replace this adapter with a real
 * provider by adding another AuthGateway and wiring it in the composition root.
 */
const MOCK_EMAIL = 'admin@cityturfer.com';
const MOCK_PASSWORD = 'admin1234';
const ADMIN: User = { id: userId('admin'), email: MOCK_EMAIL, displayName: 'Admin' };

export class MockAuthGateway implements AuthGateway {
  async signIn(email: Email, password: string): Promise<SignInOutcome> {
    return email.value === MOCK_EMAIL && password === MOCK_PASSWORD
      ? { kind: 'signed-in', user: ADMIN }
      : { kind: 'invalid-credentials' };
  }
  async userById(id: UserId): Promise<User | null> {
    return id === ADMIN.id ? ADMIN : null;
  }
}
