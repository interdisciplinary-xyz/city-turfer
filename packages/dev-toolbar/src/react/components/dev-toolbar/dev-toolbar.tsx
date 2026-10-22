'use client';

import { ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useRecordRouteVisit } from '../../hooks/use-record-route-visit';
import { useResolveRouteNavigation } from '../../hooks/use-resolve-route-navigation';
import { useRouteAutoplay } from '../../hooks/use-route-autoplay';
import { useRouteAutoplayState } from '../../hooks/use-route-autoplay-state';
import { configureDevToolbar, getDevToolbarConfig } from '../../utils/dev-toolbar-config';
import { isLocalHostname } from '../../utils/is-local-hostname';
import { DEV_TOOLBAR_ROW_HEIGHT_PX, RequestLogger } from '../request-logger';
import { DevToolbarSwitch } from './components/dev-toolbar-switch';
import { DEV_TOOLBAR_Z_INDEX, type DevToolbarProps } from './dev-toolbar.constants';

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(getDevToolbarConfig().storageKeys.local.TOOLBAR_COLLAPSED) === '1';
  } catch {
    return false;
  }
};

const writeCollapsed = (collapsed: boolean) => {
  try {
    localStorage.setItem(getDevToolbarConfig().storageKeys.local.TOOLBAR_COLLAPSED, collapsed ? '1' : '0');
  } catch {
    // Private mode / blocked storage — the toggle just won't persist.
  }
};

/**
 * Sticky bottom toolbar for local development. The caller gates it on
 * `NODE_ENV === 'development'` (so it is stripped from production bundles
 * and from the `next start` e2e server); this component additionally
 * renders only on a local hostname, resolved after mount to keep SSR and
 * the first client render identical.
 *
 * Everything app-specific arrives as a prop (plan R8) — the host app wraps
 * it in an adapter that reads its own auth, brand and locale config.
 */
export const DevToolbar = ({
  user,
  brandLabel,
  locale,
  locales,
  defaultLocale,
  links,
  storagePrefix,
  languageSwitcher,
  switches = [],
  requestLogger = true,
}: DevToolbarProps) => {
  // First, before any hook or child reads storage keys / locale prefixes.
  configureDevToolbar({ storagePrefix, locales, defaultLocale });
  const pathname = usePathname();
  const [isLocal, setIsLocal] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [viewport, setViewport] = useState<string | null>(null);
  // Before the early returns: visits must be recorded while collapsed too.
  useRecordRouteVisit(isLocal);
  useResolveRouteNavigation(isLocal);
  useRouteAutoplay(isLocal);
  const autoplay = useRouteAutoplayState();

  useEffect(() => {
    setIsLocal(isLocalHostname(window.location.hostname));
    setCollapsed(readCollapsed());

    const updateViewport = () => {
      setViewport(`${window.innerWidth}×${window.innerHeight}`);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  if (!isLocal) {
    return null;
  }

  const toggle = () => {
    setCollapsed((prev) => {
      writeCollapsed(!prev);
      return !prev;
    });
  };

  if (collapsed) {
    return (
      <button
        type='button'
        onClick={toggle}
        aria-label='Expand dev toolbar'
        className={`fixed bottom-[20px] left-[68px] ${DEV_TOOLBAR_Z_INDEX} flex items-center gap-[6px] rounded-full bg-neutral-950 px-[10px] py-[6px] font-mono text-[11px] text-white shadow-lg`}
      >
        <Wrench className='size-[12px]' />
        {autoplay.playing && (
          <span className='text-emerald-300' title='Route-map autoplay is running'>
            ▶ {autoplay.attempted.length}
          </span>
        )}
        <ChevronUp className='size-[12px]' />
      </button>
    );
  }

  const role = user?.role;

  return (
    <>
      {/* In-flow spacer so the fixed bar never hides the page's last row. */}
      <div aria-hidden style={{ height: DEV_TOOLBAR_ROW_HEIGHT_PX * (requestLogger ? 2 : 1) }} />
      <div
        className={`fixed inset-x-0 bottom-0 ${DEV_TOOLBAR_Z_INDEX} border-t border-solid border-white bg-neutral-950 font-mono text-[11px] text-white/70`}
      >
        <div
          role='toolbar'
          aria-label='Dev toolbar'
          style={{ height: DEV_TOOLBAR_ROW_HEIGHT_PX }}
          className='flex items-center gap-[16px] whitespace-nowrap px-[12px]'
        >
          {/* Info scrolls on narrow viewports; the actions stay outside the
            scroller so the language switcher's drop-up menu isn't clipped. */}
          <div className='flex min-w-0 flex-1 items-center gap-[16px] overflow-x-auto'>
            <span className='flex items-center gap-[6px] font-semibold text-white'>
              <Wrench className='size-[12px]' />
              DEV
            </span>

            <span>
              {brandLabel} · {locale}
            </span>

            <span title='Viewport · active Tailwind breakpoint'>
              {viewport}{' '}
              <span className='text-teal-400'>
                <span className='sm:hidden'>xs</span>
                <span className='hidden sm:inline md:hidden'>sm</span>
                <span className='hidden md:inline lg:hidden'>md</span>
                <span className='hidden lg:inline xl:hidden'>lg</span>
                <span className='hidden xl:inline 2xl:hidden'>xl</span>
                <span className='hidden 2xl:inline'>2xl</span>
              </span>
            </span>

            <span className='max-w-[240px] truncate' title={pathname}>
              {pathname}
            </span>

            <span>
              {user?.email ? (
                <>
                  {user.email} · <span className='text-white'>{user.plan ?? 'free'}</span>
                  {role ? ` · ${role}` : null}
                </>
              ) : (
                'anonymous'
              )}
            </span>
          </div>

          <div className='flex shrink-0 items-center gap-[12px]'>
            {switches.map((item) => (
              <DevToolbarSwitch key={item.id} {...item} />
            ))}
            {languageSwitcher}
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target='_blank'
                rel='noopener noreferrer'
                className='transition-colors hover:text-white'
              >
                {link.label}
              </a>
            ))}
            <button
              type='button'
              onClick={toggle}
              aria-label='Collapse dev toolbar'
              className='transition-colors hover:text-white'
            >
              <ChevronDown className='size-[14px]' />
            </button>
          </div>
        </div>

        {/* Second row: the API logger (live requests / route map), unless the host turns it off. */}
        {requestLogger && <RequestLogger />}
      </div>
    </>
  );
};
