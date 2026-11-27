import { useCallback, useEffect, useRef, useState } from 'react';

import { classifyError } from './classify-error';
import { useToast } from './toast-provider';
import type { MessageRef } from './toast-provider.constants';
import {
  type AsyncAction,
  type AsyncActionOptions,
  type AsyncActionOutcome,
  type ErrorClass,
  GENERIC_ERROR_KEY,
  OFFLINE_ERROR_KEY,
} from './use-async-action.constants';

/** Errors already reported (one error handed on through two actions is still one report). */
const reported = new WeakSet<object>();

function reportOnce(report: () => void, error: unknown): void {
  if (typeof error === 'object' && error !== null) {
    if (reported.has(error)) {
      return;
    }
    reported.add(error);
  }
  report();
}

function errorMessage<T>(options: AsyncActionOptions<T>, error: unknown, kind: ErrorClass): MessageRef | null {
  const { errorKey } = options;
  if (errorKey === null) {
    return null;
  }
  const chosen = typeof errorKey === 'function' ? errorKey(error, kind) : undefined;
  if (chosen !== undefined) {
    return chosen;
  }
  if (kind.expected && kind.message) {
    return kind.message;
  }
  if (kind.expected && kind.reason === 'offline') {
    return OFFLINE_ERROR_KEY;
  }
  return (typeof errorKey === 'function' ? undefined : errorKey) ?? GENERIC_ERROR_KEY;
}

/**
 * The standard for every async request the Turfer starts (the founder's rule):
 * - try: loading on; when the work is done, a success toast (only with `successKey`: results the
 *   screen doesn't show by itself);
 * - catch: an unexpected error goes to crash reporting (once), then an error toast; an expected one
 *   (offline, API 4xx, `DomainError`, permission, router budget, `ExpectedFailure`) only shows its
 *   message;
 * - finally: loading off.
 * One run at a time (a double tap runs once: `busy`). `run` never throws and is safe after the
 * screen has gone: the toast still shows (the host is in the root layout), no state is set.
 *
 *   const { run, isLoading } = useAsyncAction({ area: 'cloud-backup', successKey: 'backup.toast.backedUp' });
 *   <Button busy={isLoading} onPress={() => void run(() => backUpNow())} />
 */
export function useAsyncAction<T = unknown>(options: AsyncActionOptions<T>): AsyncAction<T> {
  const toast = useToast();
  const [isLoading, setLoading] = useState(false);
  // A ref, not the state: a second tap in the same frame must see the first run.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  // The latest options without re-creating `run` (screens pass inline objects).
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (work: () => Promise<T>): Promise<AsyncActionOutcome<T>> => {
      if (inFlight.current) {
        return { status: 'busy' };
      }
      inFlight.current = true;
      setLoading(true);
      try {
        const value = await work();
        const { successKey } = latest.current;
        const success = typeof successKey === 'function' ? successKey(value) : successKey;
        if (success) {
          toast.show({ variant: 'success', message: success });
        }
        return { status: 'done', value };
      } catch (error) {
        const o = latest.current;
        const classified = classifyError(error);
        const kind: ErrorClass =
          !classified.expected && o.isExpected?.(error) ? { expected: true, reason: 'stated' } : classified;
        if (!kind.expected) {
          reportOnce(() => toast.reporter.report(error, { area: o.area, code: o.code }), error);
        }
        const message = errorMessage(o, error, kind);
        if (message) {
          toast.show({ variant: 'error', message });
        }
        return { status: 'failed', error, kind, message };
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setLoading(false);
        }
      }
    },
    [toast]
  );

  return { run, isLoading };
}
