/**
 * The problem `code` catalogue (docs/decisions/api-sync-2026-10-20.md, "Errors"): every non-2xx
 * answer uses one of these codes, with this status and title. Domain codes are the domain's
 * `DomainError.code`s, so a use case's error maps to an HTTP answer in one place.
 */
export const PROBLEM_CODES = {
  'invalid-request': { status: 400, title: 'Invalid request' },
  'auth.missing': { status: 401, title: 'Missing bearer token or session cookie' },
  'auth.invalid': { status: 401, title: 'Invalid or expired token' },
  'auth.invalid-code': { status: 401, title: 'Wrong or expired code: ask for a new one' },
  'auth.csrf': { status: 403, title: 'Cross-site request refused: send it from the CityTurfer website' },
  'consent.required': { status: 403, title: 'Give the cloud-sync consent first' },
  'not-found': { status: 404, title: 'Not found' },
  'activity.deleted': { status: 410, title: 'Activity was deleted' },
  'sync.cursor-expired': { status: 410, title: 'Sync cursor expired: sync again without a cursor' },
  'export.gone': { status: 410, title: 'This download link was used or has expired' },
  'precondition-failed': { status: 412, title: 'The resource changed since your version' },
  'payload-too-large': { status: 413, title: 'Request body too large' },
  'unsupported-media-type': { status: 415, title: 'Unsupported content type or encoding' },
  'activity.track-too-short': { status: 422, title: 'A track needs at least two points' },
  'activity.ends-before-start': { status: 422, title: 'The activity ends before it starts' },
  'activity.invalid-name': { status: 422, title: 'Names are 1 to 80 characters' },
  'activity.track-hash-mismatch': { status: 422, title: 'trackHash does not match the track' },
  'activity.renamed-in-future': { status: 422, title: 'renamedAt is more than 5 minutes ahead of the server' },
  'activity.source-mismatch': { status: 422, title: 'source does not match the id (hk-… is apple-health)' },
  'home-city.unknown': { status: 422, title: 'Not a catalogue city' },
  'export.no-email': { status: 422, title: 'The account has no e-mail to send the export link to' },
  'client.too-old': { status: 426, title: 'Update the app to sync' },
  'precondition-required': { status: 428, title: 'Send If-Match to change an existing resource' },
  'rate-limited': { status: 429, title: 'Too many requests' },
  'auth.rate-limited': { status: 429, title: 'Too many codes or sign-ins: wait and try again' },
  internal: { status: 500, title: 'Something went wrong' },
  'not-implemented': { status: 501, title: 'Not implemented yet' },
  'storage.unavailable': { status: 503, title: 'Storage is not available: retry later' },
} as const;

export type ProblemCode = keyof typeof PROBLEM_CODES;

export const PROBLEM_CODE_LIST = Object.keys(PROBLEM_CODES) as [ProblemCode, ...ProblemCode[]];

export function isProblemCode(code: unknown): code is ProblemCode {
  return typeof code === 'string' && Object.hasOwn(PROBLEM_CODES, code);
}
