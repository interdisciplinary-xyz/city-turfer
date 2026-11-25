import type { MessageKey, MessageRef } from './toast-provider.constants';

/**
 * Why an action failed. Expected failures are the world, not a bug: offline or unreachable, an
 * API refusal (4xx problem), a broken business rule (`DomainError`), a permission the Turfer
 * denied, the router's budget, or a failure the call site stated (`ExpectedFailure`). They show a
 * message and are never reported. Everything else is unexpected: reported once, generic message.
 */
export type ErrorClass =
  | {
      expected: true;
      reason: 'offline' | 'api' | 'domain' | 'permission' | 'router' | 'stated';
      /** The error's stable code when it has one (`DomainError.code`, a problem code). */
      code?: string;
      /** The message a stated failure carries. */
      message?: MessageRef;
    }
  | { expected: false };

export type AsyncActionOptions<T> = {
  /** Crash-report area of an unexpected error ('cloud-backup', 'identity', 'share-photo'…). */
  area: string;
  /** Optional stable code for the report ('backup-now', 'delete-activity'): groups the reports. */
  code?: string;
  /**
   * Success toast, only for a result the screen does not show by itself. A function decides from
   * the work's value (null: no toast, e.g. a backup that was skipped).
   */
  successKey?: MessageRef | ((value: T) => MessageRef | null);
  /**
   * Error toast. Default: the stated message, else "No connection…" when offline, else the generic
   * message. A key replaces the generic message; a function decides from the error and its class
   * (null: no toast; undefined: the default). `null`: never a toast — a form that shows its error
   * inline reads `failed`.
   */
  errorKey?: MessageRef | null | ((error: unknown, kind: ErrorClass) => MessageRef | null | undefined);
  /** Errors this action also expects (on top of `classifyError`): shown, not reported. */
  isExpected?: (error: unknown) => boolean;
};

/** What `run` resolved with. `busy`: another run of this action was still going, nothing ran. */
export type AsyncActionOutcome<T> =
  | { status: 'done'; value: T }
  | { status: 'failed'; error: unknown; kind: ErrorClass; message: MessageRef | null }
  | { status: 'busy' };

export type AsyncAction<T> = {
  /** Runs `work` once at a time: loading on, success toast, or report + error toast, loading off. Never throws. */
  run: (work: () => Promise<T>) => Promise<AsyncActionOutcome<T>>;
  isLoading: boolean;
};

export const GENERIC_ERROR_KEY: MessageKey = 'common.toast.error.generic';
export const OFFLINE_ERROR_KEY: MessageKey = 'common.toast.error.offline';

/** Thrown error names that mean "no connection" (React Native's fetch, aborts and timeouts, the router). */
export const OFFLINE_NAMES: readonly string[] = ['AbortError', 'TimeoutError', 'RouterUnreachable'];

/** React Native's fetch rejects with this TypeError message when there is no connection. */
export const OFFLINE_MESSAGE = /network request failed|network error|internet connection appears to be offline/i;

/** Error codes of native modules for a permission the Turfer denied. */
export const PERMISSION_CODE = /permission|not[-_ ]?authori[sz]ed|denied/i;
