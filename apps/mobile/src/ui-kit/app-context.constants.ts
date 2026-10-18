import type { Container } from '@/composition-root';
import type { User } from '@/contexts/identity';

export type AuthState =
  { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: User; container: Container };

export interface AppContextValue {
  auth: AuthState;
  /** Increments whenever persisted data changed (outbox processed). */
  dataVersion: number;
  signIn(email: string, password: string): Promise<'ok' | 'invalid'>;
  signOut(): Promise<'ok' | 'recording-in-progress'>;
}
