/**
 * CLLocationManager errors that iOS sends in ordinary use, forwarded by expo-location's task as
 * `{ code }`: kCLErrorLocationUnknown (0: no fix right now, e.g. an underpass or indoors) and
 * kCLErrorDenied (1: the Turfer set location to "Never" mid-recording). Logged on the phone, never
 * reported: a denied permission is expected, and code 0 would bury real recording failures.
 */
const EXPECTED_CODES: ReadonlySet<unknown> = new Set([0, 1, '0', '1']);

export function isExpectedLocationTaskError(code: unknown): boolean {
  return EXPECTED_CODES.has(code);
}
