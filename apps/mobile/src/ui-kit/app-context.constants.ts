import type { Container } from '@/composition-root';
import type {
  DeleteAccountResult,
  IdentityApi,
  StartSignInResult,
  User,
  VerifySignInResult,
} from '@/contexts/identity';

export type AuthState =
  { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: User; container: Container };

export interface AppContextValue {
  auth: AuthState;
  /** Increments whenever persisted data changed (outbox processed). */
  dataVersion: number;
  /** Local profiles (mock admin, demo): email + password. */
  signIn(email: string, password: string): Promise<'ok' | 'invalid'>;
  /** Accounts, step 1: a local profile's email asks for its password, any other gets a code. */
  startSignIn(email: string): Promise<StartSignInResult>;
  /** Step 2: the emailed code; `choose-history` asks whether to use this phone's history. */
  verifyCode(email: string, code: string): Promise<Exclude<VerifySignInResult, { kind: 'signed-in' }> | { kind: 'ok' }>;
  /** Step 3 (only after `choose-history`). */
  chooseHistory(useThisPhonesHistory: boolean): Promise<'ok' | 'no-pending'>;
  signOut(): Promise<'ok' | 'recording-in-progress'>;
  /** Deletes the account on the server; `keepData` false also deletes this phone's copy. */
  deleteAccount(keepData: boolean): Promise<Exclude<DeleteAccountResult, { kind: 'deleted' }> | { kind: 'ok' }>;
  /** "Export my data": the server emails a download link. */
  requestDataExport(): Promise<ExportRequestResult>;
}

export type ExportRequestResult = Awaited<ReturnType<IdentityApi['requestDataExport']['execute']>>;
