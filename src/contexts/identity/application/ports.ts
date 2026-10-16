import type { Email, User, UserId } from '../domain/user';

export type SignInOutcome = { kind: 'signed-in'; user: User } | { kind: 'invalid-credentials' };

export interface AuthGateway {
  signIn(email: Email, password: string): Promise<SignInOutcome>;
  userById(id: UserId): Promise<User | null>;
}

/** Persists who is signed in, readable by the headless background task. */
export interface SessionStore {
  read(): Promise<UserId | null>;
  write(id: UserId): Promise<void>;
  clear(): Promise<void>;
}
