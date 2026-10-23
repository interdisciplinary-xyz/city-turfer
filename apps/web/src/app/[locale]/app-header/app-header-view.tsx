import type { AppHeaderViewProps } from './app-header.constants';
import { ScrollState } from './scroll-state';

/**
 * The header's markup, free of Next: the site renders it through `AppHeader`, and the local
 * Storybook and Swagger pages through `tools/app-header-entry.mjs`, so they never drift apart.
 * Styles: `app-header.css`.
 */
export function AppHeaderView({
  homeHref,
  homeLabel,
  logo,
  waitlist,
  account,
  languages,
  lockupSelector,
}: AppHeaderViewProps) {
  return (
    <header className='app-header'>
      <div className='app-header-inner'>
        <a className='app-header-home' href={homeHref} aria-label={homeLabel}>
          {logo}
        </a>
        <div className='app-header-actions'>
          {waitlist ? (
            <a className='app-header-link' href={waitlist.href} aria-label={waitlist.label}>
              <span className='app-header-link-long'>{waitlist.label}</span>
              <span className='app-header-link-short' aria-hidden='true'>
                {waitlist.shortLabel}
              </span>
            </a>
          ) : null}
          {account ? (
            <>
              <a className='app-header-link' href={account.signIn.href}>
                {account.signIn.label}
              </a>
              <a className='app-header-cta' href={account.register.href}>
                {account.register.label}
              </a>
            </>
          ) : null}
          {languages}
        </div>
        <ScrollState lockupSelector={lockupSelector} />
      </div>
    </header>
  );
}
