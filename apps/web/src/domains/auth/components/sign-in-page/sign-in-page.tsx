'use client';

import { useEffect, useState } from 'react';

import { SignInForm } from '@/domains/auth/components/sign-in-form';
import { PortalFrame } from '@/domains/portal';
import { useRequestCode, useSignIn } from '@/lib/api/hooks';
import { parseSignInReason, safeNextPath, signInHref, type SignInReason } from '@/lib/api/next-path';

import type { SignInPageProps } from './sign-in-page.constants';

/**
 * The sign-in page, and in `register` mode the "Create account" page: one flow, because an
 * e-mailed code for a new address creates the account. Reads `?next=` (validated: a portal path only) and `?reason=` after load (the
 * page is a static shell), and after signing in replaces itself with `next`, so Back doesn't land
 * on the code form again.
 */
export function SignInPage({ locale, mode = 'sign-in' }: SignInPageProps) {
  const requestCode = useRequestCode();
  const signIn = useSignIn();
  const [reason, setReason] = useState<SignInReason | null>(null);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReason(parseSignInReason(params.get('reason')));
    setNext(params.get('next'));
  }, []);

  return (
    <PortalFrame locale={locale} path={signInHref(locale, { next, reason, mode })}>
      <SignInForm
        mode={mode}
        switchHref={`/${locale}${signInHref(locale, { next, mode: mode === 'register' ? 'sign-in' : 'register' })}`}
        reason={reason}
        onRequestCode={(email) => requestCode.mutateAsync(email)}
        onSignIn={async (attempt) => {
          await signIn.mutateAsync(attempt);
          window.location.replace(safeNextPath(next, locale));
        }}
      />
    </PortalFrame>
  );
}
