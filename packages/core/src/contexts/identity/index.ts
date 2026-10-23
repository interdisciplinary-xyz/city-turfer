// Public API of the Identity context.
import {
  ConfirmEmailChange,
  GetAccountSettings,
  RemovePassword,
  RequestEmailChange,
  RequestStepUpCode,
  SetPassword,
  UpdateName,
} from './application/account-settings';
import {
  AccountBearer,
  ChooseHistory,
  DeleteAccount,
  GetCurrentUser,
  type IdentityDeps,
  PendingSignIn,
  RequestDataExport,
  SignIn,
  SignInWithPassword,
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
    /** Accounts with a password: the alternative to the code; then like a verified code. */
    signInWithPassword: new SignInWithPassword(deps, pending),
    chooseHistory: new ChooseHistory(deps, pending),
    signOut: new SignOut(deps, isRecording),
    deleteAccount: new DeleteAccount(deps, isRecording),
    requestDataExport: new RequestDataExport(deps),
    currentUser: new GetCurrentUser(deps),
    /** Open-host service for Cloud Backup: the signed-in account's bearer for a profile. */
    accountBearer: new AccountBearer(deps),
    /** Me › Account (online only, nothing queued): name, e-mail, optional password. */
    accountSettings: new GetAccountSettings(deps),
    updateName: new UpdateName(deps),
    requestStepUpCode: new RequestStepUpCode(deps),
    requestEmailChange: new RequestEmailChange(deps),
    confirmEmailChange: new ConfirmEmailChange(deps),
    setPassword: new SetPassword(deps),
    removePassword: new RemovePassword(deps),
  };
}
export type IdentityApi = ReturnType<typeof createIdentityApi>;
export type {
  AccountSettings,
  ConfirmEmailChangeResult,
  NotSignedIn,
  RequestEmailChangeResult,
  SetPasswordResult,
  UpdateNameResult,
} from './application/account-settings';
export type { AccountFailure, FieldRefused } from './application/ports';
export type {
  AccountDeps,
  DeleteAccountResult,
  IdentityDeps,
  PasswordSignInResult,
  SignInResult,
  SignOutResult,
  StartSignInResult,
  VerifySignInResult,
} from './application/use-cases';
export {
  ACCOUNT_FIELD_ERRORS,
  type AccountFieldError,
  accountFieldError,
  DISPLAY_NAME_MAX,
  displayName,
  isAccountFieldError,
  newEmail,
  newPassword,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from './domain/account-fields';
export { isLocalOnlyProfile, type User } from './domain/user';
