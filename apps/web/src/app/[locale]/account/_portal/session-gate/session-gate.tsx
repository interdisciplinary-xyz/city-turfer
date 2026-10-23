'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { useMe, useSignOut } from '@/api/hooks';

import { ErrorMessage } from '../error-message';
import { PortalFrame } from '../portal-frame';
import { PortalNav } from '../portal-nav';
import { portalLocation } from '../portal-nav/portal-nav.constants';
import { SignOutButton } from '../sign-out-button';
import { Unreachable } from '../unreachable';
import { type GateBodyProps, gateView, type SessionGateProps } from './session-gate.constants';

/**
 * The client gate of every signed-in page (decision D1: static shells, no server guard). It asks
 * `GET /v1/me`; a 401 goes to sign-in through the API client (cache cleared, full page load), so
 * the page renders nothing personal until the API has said who this is. Once it has, a failed
 * background refetch keeps the page (and whatever the user was doing on it) with a small notice.
 */
export function SessionGate({ locale, children }: SessionGateProps) {
  // The query (an activity's `?id=`) is only known in the browser: the static export renders the
  // fallback (the same gate, without the query), the browser the real one (Next: useSearchParams
  // needs a Suspense boundary under prerendering).
  return (
    <Suspense
      fallback={
        <GateBody locale={locale} search={null}>
          {children}
        </GateBody>
      }
    >
      <GateWithQuery locale={locale}>{children}</GateWithQuery>
    </Suspense>
  );
}

function GateWithQuery({ locale, children }: SessionGateProps) {
  const search = useSearchParams();
  return (
    <GateBody locale={locale} search={search}>
      {children}
    </GateBody>
  );
}

function GateBody({ locale, search, children }: GateBodyProps) {
  const pathname = usePathname();
  const { path, section, exact } = portalLocation(pathname, locale, search);
  const nav = <PortalNav locale={locale} section={section} exact={exact} />;
  const t = useTranslations('portal.gate');
  const tc = useTranslations('portal.common');
  const me = useMe();
  const signOut = useSignOut();
  const view = gateView({ hasData: me.data !== undefined, error: me.error });
  const retry = () => void me.refetch();

  if (view.kind === 'page') {
    return (
      <PortalFrame
        locale={locale}
        path={path}
        nav={nav}
        headerActions={
          <SignOutButton onSignOut={() => signOut.mutate()} pending={signOut.isPending || signOut.isSuccess} />
        }
      >
        {/* A failed sign-out (offline, 5xx, 403): still signed in here, so say so and keep the button. */}
        {signOut.error ? <ErrorMessage error={signOut.error} className='portal-sign-out-error' /> : null}
        {view.refreshFailed ? (
          <p className='portal-hint portal-refresh-failed' role='status'>
            {t('refreshFailed')}{' '}
            <button
              className='portal-button portal-button-quiet'
              type='button'
              onClick={retry}
              disabled={me.isFetching}
            >
              {tc('retry')}
            </button>
          </p>
        ) : null}
        {children}
      </PortalFrame>
    );
  }
  return (
    <PortalFrame locale={locale} path={path} nav={nav}>
      {view.kind === 'unreachable' ? <Unreachable onRetry={retry} retrying={me.isFetching} /> : null}
      {view.kind === 'error' ? (
        <>
          <ErrorMessage error={view.error} />
          <button
            className='portal-button portal-button-secondary'
            type='button'
            onClick={retry}
            disabled={me.isFetching}
          >
            {tc('retry')}
          </button>
        </>
      ) : null}
      {view.kind === 'leaving' || view.kind === 'checking' ? (
        <p className='portal-muted' role='status'>
          {view.kind === 'leaving' ? t('leaving') : t('checking')}
        </p>
      ) : null}
    </PortalFrame>
  );
}
