'use client';

import { useTranslations } from 'next-intl';

import { useMe, useSignOut } from '@/api/hooks';

import { ErrorMessage } from '../error-message';
import { PortalFrame } from '../portal-frame';
import { SignOutButton } from '../sign-out-button';
import { Unreachable } from '../unreachable';
import { gateView, type SessionGateProps } from './session-gate.constants';

/**
 * The client gate of every signed-in page (decision D1: static shells, no server guard). It asks
 * `GET /v1/me`; a 401 goes to sign-in through the API client (cache cleared, full page load), so
 * the page renders nothing personal until the API has said who this is. Once it has, a failed
 * background refetch keeps the page (and whatever the user was doing on it) with a small notice.
 */
export function SessionGate({ locale, path, children }: SessionGateProps) {
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
    <PortalFrame locale={locale} path={path}>
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
