import type { ReactNode } from 'react';

/**
 * The toolbar's layer: below a typical admin bar (9999) and every modal
 * overlay, so modals still cover it. Package-owned so it doesn't depend on
 * the host app's z-index scale.
 */
export const DEV_TOOLBAR_Z_INDEX = 'z-[9998]';

/** The signed-in user, as far as the toolbar shows it (null = anonymous). */
export type DevToolbarUser = {
  email?: string | null;
  plan?: string | null;
  role?: string | null;
} | null;

export type DevToolbarLink = {
  label: string;
  href: string;
};

/**
 * A host-app setting the toolbar renders as a segmented control (e.g. a
 * product release, a feature variant). The toolbar only draws it; the host
 * owns what a value means and what `onChange` does.
 */
export type DevToolbarSwitch = {
  /** Stable key, also used for the control's accessible name. */
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string; title?: string }[];
  onChange: (value: string) => void;
};

export type DevToolbarProps = {
  user: DevToolbarUser;
  /** Shown in the info row, e.g. the active brand id. */
  brandLabel: string;
  /** The active locale. */
  locale: string;
  /** Every locale the app routes; all but `defaultLocale` are URL prefixes. */
  locales: readonly string[];
  defaultLocale: string;
  /** Quick links in the action row (opened in a new tab). */
  links: readonly DevToolbarLink[];
  /** Namespace for the toolbar's localStorage / sessionStorage keys. */
  storagePrefix: string;
  /**
   * The host app's language switcher, rendered by its server layout and
   * slotted in (a client module importing it directly can drag server-only
   * code into the client bundle).
   */
  languageSwitcher?: ReactNode;
  /** Host-app settings shown as segmented controls in the action row. */
  switches?: readonly DevToolbarSwitch[];
};
