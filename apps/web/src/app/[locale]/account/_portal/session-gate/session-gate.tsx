'use client';

import { useTranslations } from 'next-intl';

import { useMe, useSignOut } from '@/api/hooks';

import { ErrorMessage } from '../error-message';
import { PortalFrame } from '../portal-frame';
import { SignOutButton } from '../sign-out-button';
import { Unreachable } from '../unreachable';
import type { SessionGateProps } from './session-gate.constants';

/**
 * The client gate of every signed-in page (decision D1: static shells, no server guard). It asks
 * `GET /v1/me`; a 401 goes to sign-in through the API client (cache cleared, full page load), so
 * the page renders nothing personal until the API has said who this is.
 */
export function SessionGate({ locale, path, children }: SessionGateProps) {
  const t = useTranslations('portal.gate');
  const me = useMe();
  const signOut = useSignOut();

  if (me.isSuccess) {
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
        {children}
      </PortalFrame>
    );
  }
  const leaving = me.error?.code === 'signed-out';
  return (
    <PortalFrame locale={locale} path={path}>
      {me.isError && !leaving ? (
        <>
          <Unreachable onRetry={() => void me.refetch()} retrying={me.isFetching} />
          {me.error.code === 'generic' ? <ErrorMessage error={me.error} /> : null}
        </>
      ) : (
        <p className='portal-muted' role='status'>
          {leaving ? t('leaving') : t('checking')}
        </p>
      )}
    </PortalFrame>
  );
}
