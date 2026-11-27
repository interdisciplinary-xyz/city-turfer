import { DomainError } from '@/shared-kernel';

import type { MessageRef } from './toast-provider.constants';
import { type ErrorClass, OFFLINE_MESSAGE, OFFLINE_NAMES, PERMISSION_CODE } from './use-async-action.constants';

/**
 * A failure the call site knows and words itself (a use case's refusal turned into a throw): shown
 * with its message, never reported.
 */
export class ExpectedFailure extends Error {
  constructor(
    readonly messageRef: MessageRef,
    readonly code?: string
  ) {
    super(code ?? (typeof messageRef === 'string' ? messageRef : messageRef.key));
    this.name = 'ExpectedFailure';
  }
}

const field = (e: unknown, name: string): unknown =>
  typeof e === 'object' && e !== null ? (e as Record<string, unknown>)[name] : undefined;

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/**
 * Expected or not, for every async action the Turfer starts (`useAsyncAction`). Pure, so the rule
 * is the same everywhere and unit-tested. See `ErrorClass` for what counts as expected.
 */
export function classifyError(error: unknown): ErrorClass {
  if (error instanceof ExpectedFailure) {
    return { expected: true, reason: 'stated', code: error.code, message: error.messageRef };
  }
  const name = text(field(error, 'name'));
  const code = text(field(error, 'code'));
  if (error instanceof DomainError || name === 'DomainError') {
    return { expected: true, reason: 'domain', code };
  }
  if (name === 'RouterRateLimited') {
    return { expected: true, reason: 'router' };
  }
  const message = text(field(error, 'message')) ?? '';
  if ((name && OFFLINE_NAMES.includes(name)) || OFFLINE_MESSAGE.test(message)) {
    return { expected: true, reason: 'offline' };
  }
  const status = field(error, 'status');
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return { expected: true, reason: 'api', code: text(field(error, 'problemCode')) ?? code };
  }
  if (code && PERMISSION_CODE.test(code)) {
    return { expected: true, reason: 'permission', code };
  }
  return { expected: false };
}
