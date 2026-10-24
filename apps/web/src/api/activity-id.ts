// The phone's activity ids as the contract takes them (`ActivityId`: letters, digits, `_` and `-`,
// 1–100). Anything else in `?id=` is "not found" without asking the API, and is never echoed.
const ACTIVITY_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function isActivityId(value: string | null | undefined): value is string {
  return typeof value === 'string' && ACTIVITY_ID.test(value);
}
