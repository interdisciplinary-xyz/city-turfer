/**
 * The problem `code` catalogue (docs/decisions/api-sync-2026-10-20.md, "Errors"): every non-2xx
 * answer uses one of these codes, with this status and title. Domain codes are the domain's
 * `DomainError.code`s, so a use case's error maps to an HTTP answer in one place.
 */
export const PROBLEM_CODES = {
  'invalid-request': { status: 400, title: 'Invalid request' },
  'auth.missing': { status: 401, title: 'Missing bearer token' },
  'auth.invalid': { status: 401, title: 'Invalid or expired token' },
  'not-found': { status: 404, title: 'Not found' },
  'activity.deleted': { status: 410, title: 'Activity was deleted' },
  'sync.cursor-expired': { status: 410, title: 'Sync cursor expired: sync again without a cursor' },
  'precondition-failed': { status: 412, title: 'The resource changed since your version' },
  'payload-too-large': { status: 413, title: 'Request body too large' },
  'unsupported-media-type': { status: 415, title: 'Unsupported content type or encoding' },
  'activity.track-too-short': { status: 422, title: 'A track needs at least two points' },
  'activity.ends-before-start': { status: 422, title: 'The activity ends before it starts' },
  'activity.invalid-name': { status: 422, title: 'Names are 1 to 80 characters' },
  'activity.track-hash-mismatch': { status: 422, title: 'trackHash does not match the track' },
  'claim.in-future': { status: 422, title: 'The activity starts in the future' },
  'home-city.unknown': { status: 422, title: 'Not a catalogue city' },
  'client.too-old': { status: 426, title: 'Update the app to sync' },
  'precondition-required': { status: 428, title: 'Send If-Match to change an existing resource' },
  'rate-limited': { status: 429, title: 'Too many requests' },
  internal: { status: 500, title: 'Something went wrong' },
  'not-implemented': { status: 501, title: 'Not implemented yet' },
} as const;

export type ProblemCode = keyof typeof PROBLEM_CODES;

export const PROBLEM_CODE_LIST = Object.keys(PROBLEM_CODES) as [ProblemCode, ...ProblemCode[]];

export function isProblemCode(code: unknown): code is ProblemCode {
  return typeof code === 'string' && Object.hasOwn(PROBLEM_CODES, code);
}
