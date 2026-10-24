import { isActivityId } from '@/api/activity-id';
import { ACTIVITIES_SEGMENT, activitiesHref, ACTIVITY_SEGMENT, activityHref, PORTAL_ROOT } from '@/api/next-path';
import type { Locale } from '@/i18n/routing';

/** The two sections of the signed-in portal, as the header links them. */
export type PortalSection = 'activities' | 'privacy';

/** The header's links, in order: the history first, then Privacy & data (`/account`, where sign-in lands). */
export const PORTAL_NAV_LINKS: readonly { section: PortalSection; href: string }[] = [
  { section: 'activities', href: activitiesHref() },
  { section: 'privacy', href: PORTAL_ROOT },
];

export type PortalNavProps = {
  locale: Locale;
  /** The section this page belongs to (null: none, e.g. an unknown path). */
  section: PortalSection | null;
  /** True on the section's own page; false below it (an activity is inside Activities). */
  exact: boolean;
};

export type PortalLocation = {
  /** This page without the locale, for the language links (keeps an activity's `?id=`). */
  path: string;
  section: PortalSection | null;
  exact: boolean;
};

/**
 * Where a signed-in page is, from its pathname (and query): which header link is current, and what
 * the language links point at. Only a valid activity id is carried over; nothing else from the query.
 */
export function portalLocation(pathname: string, locale: string, search: URLSearchParams | null): PortalLocation {
  const below =
    pathname.startsWith(`/${locale}/`) || pathname === `/${locale}` ? pathname.slice(locale.length + 1) : pathname;
  const path = below.length > 1 ? below.replace(/\/$/, '') : below;
  if (path === PORTAL_ROOT) {
    return { path, section: 'privacy', exact: true };
  }
  if (path === `${PORTAL_ROOT}${ACTIVITIES_SEGMENT}`) {
    return { path, section: 'activities', exact: true };
  }
  if (path === `${PORTAL_ROOT}${ACTIVITY_SEGMENT}`) {
    const id = search?.get('id');
    return { path: isActivityId(id) ? activityHref(id) : path, section: 'activities', exact: false };
  }
  return { path: path || PORTAL_ROOT, section: null, exact: false };
}
