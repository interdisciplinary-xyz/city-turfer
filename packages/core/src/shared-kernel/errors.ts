/** A broken business rule. `code` is stable and mapped to user-facing copy in ui/. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'DomainError';
  }
}
