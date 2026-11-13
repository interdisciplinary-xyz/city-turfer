import { type AppHeaderViewProps, HEADER_VARIABLES } from './app-header.constants';

/**
 * The header's markup, free of Next: the site renders it through `AppHeader`, and the local
 * Storybook and Swagger pages through `tools/app-header-entry.mjs`, so they never drift apart.
 * Styles: `app-header.css`.
 */
export function AppHeaderView({ homeHref, homeLabel, logo, nav, languages }: AppHeaderViewProps) {
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
        <div className='app-header-actions'>{languages}</div>
      </div>
    </header>
  );
}
