import { DomainError } from '../../../shared-kernel';
import { email as parseEmail, type User } from '../domain/user';
import type { AuthGateway, SessionStore, SignInOutcome } from './ports';

export interface IdentityDeps {
  auth: AuthGateway;
  sessions: SessionStore;
}

export class SignIn {
  constructor(private readonly d: IdentityDeps) {}
  async execute(rawEmail: string, password: string): Promise<SignInOutcome | { kind: 'invalid-email' }> {
    let parsed;
    try {
      parsed = parseEmail(rawEmail);
    } catch (e) {
      if (e instanceof DomainError) {
        return { kind: 'invalid-email' };
      }
      throw e;
    }
    const outcome = await this.d.auth.signIn(parsed, password);
    if (outcome.kind === 'signed-in') {
      await this.d.sessions.write(outcome.user.id);
    }
    return outcome;
  }
}

export class GetCurrentUser {
  constructor(private readonly d: IdentityDeps) {}
  async execute(): Promise<User | null> {
    const id = await this.d.sessions.read();
    return id ? this.d.auth.userById(id) : null;
  }
}

export type SignOutResult = { kind: 'signed-out' } | { kind: 'recording-in-progress' };

export class SignOut {
  constructor(
    private readonly d: IdentityDeps,
    private readonly isRecording: () => Promise<boolean>
  ) {}
  async execute(): Promise<SignOutResult> {
    if (await this.isRecording()) {
      return { kind: 'recording-in-progress' };
    }
    await this.d.sessions.clear();
    return { kind: 'signed-out' };
  }
}
