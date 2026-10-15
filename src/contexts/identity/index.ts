// Public API of the Identity context.
import { GetCurrentUser, type IdentityDeps, SignIn, SignOut } from './application/useCases';

export function createIdentityApi(deps: IdentityDeps, isRecording: () => Promise<boolean>) {
  return {
    signIn: new SignIn(deps),
    signOut: new SignOut(deps, isRecording),
    currentUser: new GetCurrentUser(deps),
  };
}
export type IdentityApi = ReturnType<typeof createIdentityApi>;
export type { IdentityDeps } from './application/useCases';
export type { User } from './domain/User';
