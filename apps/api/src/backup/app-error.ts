import type { ProblemCode } from '../errors';

/**
 * A use case's refusal that is not a domain rule (consent, precondition, tombstone, not found):
 * the shared error handler answers it as problem+json with this catalogue code.
 */
export class AppError extends Error {
  constructor(
    readonly code: ProblemCode,
    readonly headers: Record<string, string> = {}
  ) {
    super(code);
    this.name = 'AppError';
  }
}
