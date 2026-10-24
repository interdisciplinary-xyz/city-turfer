// Where the portal sends people: the sign-in page, and back to where they were (`?next=`).
// `next` is only ever a same-origin path inside the portal root, so a crafted sign-in link can't
// send anyone to another site (open redirect) or carry data in a query or fragment. The one query
// kept is a valid activity id on the activity page (H2: an opaque id, never a coordinate).
import { routing } from '@/i18n/routing';

import { isActivityId } from './activity-id';

/** The portal root, below the locale (decision D3). */
export const PORTAL_ROOT = '/account';
export const SIGN_IN_SEGMENT = '/sign-in';
/** "Create account": the same e-mailed-code flow (a new address gets an account), its own copy. */
export const REGISTER_SEGMENT = '/register';

/** The activity history (docs/plans/web-portal-history-2026-10-23.md): the list, and one activity (H2). */
export const ACTIVITIES_SEGMENT = '/activities';
export const ACTIVITY_SEGMENT = '/activity';

/** Which of the two code pages: signing in, or creating an account. */
export type AuthMode = 'sign-in' | 'register';

/** Why the sign-in page is shown, as a short word in the URL (never personal data). */
export type SignInReason = 'signed-out' | 'expired' | 'deleted';

const SIGN_IN_REASONS: readonly SignInReason[] = ['signed-out', 'expired', 'deleted'];

/** Lower-case segments of letters, digits and hyphens: what portal routes are made of. */
const PORTAL_PATH = new RegExp(`^/(${routing.locales.join('|')})${PORTAL_ROOT}(/[a-z0-9-]+)*/?$`);

export function portalHome(locale: string): string {
  return `/${locale}${PORTAL_ROOT}`;
}

/** The list of backed-up activities, below the locale (for links and the language switcher). */
export function activitiesHref(): string {
  return `${PORTAL_ROOT}${ACTIVITIES_SEGMENT}`;
}

/** One activity, below the locale: its opaque id in the query (H2), never a coordinate. */
export function activityHref(id: string): string {
  return `${PORTAL_ROOT}${ACTIVITY_SEGMENT}?${new URLSearchParams({ id }).toString()}`;
}

export function signInPage(locale: string): string {
  return `${portalHome(locale)}${SIGN_IN_SEGMENT}`;
}

export function registerPage(locale: string): string {
  return `${portalHome(locale)}${REGISTER_SEGMENT}`;
}

/**
 * The validated `next` target: a portal path (any locale) that isn't the sign-in or register page;
 * anything else (absolute or protocol-relative URLs, backslashes, `..`, encoded tricks, queries,
 * fragments, paths outside the portal) falls back to the portal home of `locale`.
 */
export function safeNextPath(raw: string | null | undefined, locale: string): string {
  const fallback = portalHome(locale);
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) {
    return fallback;
  }
  const activity = activityNext(raw);
  if (activity) {
    return activity;
  }
  if (!PORTAL_PATH.test(raw)) {
    return fallback;
  }
  const trimmed = raw.replace(/\/$/, '');
  if (trimmed.endsWith(`${PORTAL_ROOT}${SIGN_IN_SEGMENT}`) || trimmed.endsWith(`${PORTAL_ROOT}${REGISTER_SEGMENT}`)) {
    return fallback;
  }
  return trimmed;
}

/** The activity page of any locale. */
const ACTIVITY_PAGE = new RegExp(`^/(${routing.locales.join('|')})${PORTAL_ROOT}${ACTIVITY_SEGMENT}/?$`);

/** `/<locale>/account/activity?id=<id>` with exactly one, valid `id` (and no fragment), else null. */
function activityNext(raw: string): string | null {
  const at = raw.indexOf('?');
  if (at < 0 || raw.includes('#')) {
    return null;
  }
  const path = raw.slice(0, at);
  const query = raw.slice(at + 1);
  const match = /^id=([^&=]*)$/.exec(query);
  if (!ACTIVITY_PAGE.test(path) || !match || !isActivityId(match[1])) {
    return null;
  }
  return `${path.replace(/\/$/, '')}?id=${match[1]}`;
}

/** The sign-in URL with an optional validated `next` and reason. */
export function signInUrl(
  locale: string,
  { next, reason }: { next?: string | null; reason?: SignInReason | null } = {}
): string {
  return `/${locale}${signInHref(locale, { next, reason })}`;
}

/**
 * The sign-in (or register) page below the locale, with the validated `next` and reason: what the
 * language links of those pages point at, so switching language keeps both.
 */
export function signInHref(
  locale: string,
  { next, reason, mode = 'sign-in' }: { next?: string | null; reason?: SignInReason | null; mode?: AuthMode } = {}
): string {
  const params = new URLSearchParams();
  if (next) {
    const safe = safeNextPath(next, locale);
    if (safe !== portalHome(locale)) {
      params.set('next', safe);
    }
  }
  if (reason) {
    params.set('reason', reason);
  }
  const query = params.toString();
  const page = `${PORTAL_ROOT}${mode === 'register' ? REGISTER_SEGMENT : SIGN_IN_SEGMENT}`;
  return query ? `${page}?${query}` : page;
}

export function parseSignInReason(raw: string | null | undefined): SignInReason | null {
  return SIGN_IN_REASONS.find((reason) => reason === raw) ?? null;
}
