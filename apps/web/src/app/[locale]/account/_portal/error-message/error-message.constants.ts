import type { PortalError } from '@/api/errors';

export type ErrorMessageProps = {
  error: PortalError;
  /** A message key (inside `portal`) to show instead of the code's own, e.g. a section-specific 429. */
  overrideKey?: string;
  className?: string;
  /** Leave out the "try again in …" line (the sign-in form shows a live countdown instead). */
  hideWait?: boolean;
};
