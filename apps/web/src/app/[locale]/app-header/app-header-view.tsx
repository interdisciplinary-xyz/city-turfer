import { type AppHeaderViewProps, HEADER_VARIABLES } from './app-header.constants';

/**
 * The header's markup, free of Next: the site renders it through `AppHeader`, and the local
 * Storybook and Swagger pages through `tools/app-header-entry.mjs`, so they never drift apart.
 * Styles: `app-header.css`.
 */
export function AppHeaderView({ homeHref, homeLabel, logo, waitlist, nav, languages }: AppHeaderViewProps) {
  return (
    <header className='app-header' style={HEADER_VARIABLES}>
      <div className='app-header-inner'>
        <a className='app-header-home' href={homeHref} aria-label={homeLabel}>
          {logo}
        </a>
        {nav ? (
          <nav className='app-header-nav' aria-label={nav.label}>
            <ul>
              {nav.items.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className='app-header-actions'>
          {waitlist ? (
            // No aria-label: the accessible name is the visible text. Each span is display:none at the other
            // width (app-header.css), so a screen reader hears only the label that is shown.
            <a className='app-header-link' href={waitlist.href}>
              <span className='app-header-link-long'>{waitlist.label}</span>
              <span className='app-header-link-short'>{waitlist.shortLabel}</span>
            </a>
          ) : null}
          {languages}
        </div>
      </div>
    </header>
  );
}
