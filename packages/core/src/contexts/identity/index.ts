// Public API of the Identity context.
import {
  AccountBearer,
  ChooseHistory,
  DeleteAccount,
  GetCurrentUser,
  type IdentityDeps,
  PendingSignIn,
  RequestDataExport,
  SignIn,
  SignOut,
  StartSignIn,
  VerifySignInCode,
} from './application/use-cases';

export function createIdentityApi(deps: IdentityDeps, isRecording: () => Promise<boolean>) {
  const pending = new PendingSignIn();
  return {
    /** Local profiles (mock admin, demo): email + password. */
    signIn: new SignIn(deps),
    /** Accounts: email → one-time code → (maybe) choose this phone's history. */
    startSignIn: new StartSignIn(deps),
    verifyCode: new VerifySignInCode(deps, pending),
    chooseHistory: new ChooseHistory(deps, pending),
    signOut: new SignOut(deps, isRecording),
    deleteAccount: new DeleteAccount(deps, isRecording),
    requestDataExport: new RequestDataExport(deps),
    currentUser: new GetCurrentUser(deps),
    /** Open-host service for Cloud Backup: the signed-in account's bearer for a profile. */
    accountBearer: new AccountBearer(deps),
  };
}
export type IdentityApi = ReturnType<typeof createIdentityApi>;
export type { AccountFailure } from './application/ports';
export type {
  AccountDeps,
  DeleteAccountResult,
  IdentityDeps,
  SignInResult,
  SignOutResult,
  StartSignInResult,
  VerifySignInResult,
} from './application/use-cases';
export {
  type AccountFieldError,
  accountFieldError,
  DISPLAY_NAME_MAX,
  displayName,
  newEmail,
  newPassword,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from './domain/account-fields';
export { isLocalOnlyProfile, type User } from './domain/user';
