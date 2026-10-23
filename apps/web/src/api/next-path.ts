// Where the portal sends people: the sign-in page, and back to where they were (`?next=`).
// `next` is only ever a same-origin path inside the portal root, so a crafted sign-in link can't
// send anyone to another site (open redirect) or carry data in a query or fragment.
import { routing } from '@/i18n/routing';

/** The portal root, below the locale (decision D3). */
export const PORTAL_ROOT = '/account';
export const SIGN_IN_SEGMENT = '/sign-in';

/** Why the sign-in page is shown, as a short word in the URL (never personal data). */
export type SignInReason = 'signed-out' | 'expired' | 'deleted';

const SIGN_IN_REASONS: readonly SignInReason[] = ['signed-out', 'expired', 'deleted'];

/** Lower-case segments of letters, digits and hyphens: what portal routes are made of. */
const PORTAL_PATH = new RegExp(`^/(${routing.locales.join('|')})${PORTAL_ROOT}(/[a-z0-9-]+)*/?$`);

export function portalHome(locale: string): string {
  return `/${locale}${PORTAL_ROOT}`;
}

export function signInPage(locale: string): string {
  return `${portalHome(locale)}${SIGN_IN_SEGMENT}`;
}

/**
 * The validated `next` target: a portal path (any locale) that isn't the sign-in page itself;
 * anything else (absolute or protocol-relative URLs, backslashes, `..`, encoded tricks, queries,
 * fragments, paths outside the portal) falls back to the portal home of `locale`.
 */
export function safeNextPath(raw: string | null | undefined, locale: string): string {
  const fallback = portalHome(locale);
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) {
    return fallback;
  }
  if (!PORTAL_PATH.test(raw)) {
    return fallback;
  }
  const trimmed = raw.replace(/\/$/, '');
  if (trimmed.endsWith(`${PORTAL_ROOT}${SIGN_IN_SEGMENT}`)) {
    return fallback;
  }
  return trimmed;
}

/** The sign-in URL with an optional validated `next` and reason. */
export function signInUrl(
  locale: string,
  { next, reason }: { next?: string | null; reason?: SignInReason | null } = {}
): string {
  return `/${locale}${signInHref(locale, { next, reason })}`;
}

/**
 * The sign-in page below the locale, with the validated `next` and reason: what the language
 * links of the sign-in page point at, so switching language keeps both.
 */
export function signInHref(
  locale: string,
  { next, reason }: { next?: string | null; reason?: SignInReason | null } = {}
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
  const page = `${PORTAL_ROOT}${SIGN_IN_SEGMENT}`;
  return query ? `${page}?${query}` : page;
}

export function parseSignInReason(raw: string | null | undefined): SignInReason | null {
  return SIGN_IN_REASONS.find((reason) => reason === raw) ?? null;
}
