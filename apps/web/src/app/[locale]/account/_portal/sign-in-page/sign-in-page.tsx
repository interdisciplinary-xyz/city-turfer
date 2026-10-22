'use client';

import { useEffect, useState } from 'react';

import { useRequestCode, useSignIn } from '@/api/hooks';
import { parseSignInReason, PORTAL_ROOT, safeNextPath, SIGN_IN_SEGMENT, type SignInReason } from '@/api/next-path';

import { PortalFrame } from '../portal-frame';
import { SignInForm } from '../sign-in-form';
import type { SignInPageProps } from './sign-in-page.constants';

/**
 * The sign-in page. Reads `?next=` (validated: a portal path only) and `?reason=` after load (the
 * page is a static shell), and after signing in replaces itself with `next`, so Back doesn't land
 * on the code form again.
 */
export function SignInPage({ locale }: SignInPageProps) {
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
    <PortalFrame locale={locale} path={`${PORTAL_ROOT}${SIGN_IN_SEGMENT}`}>
      <SignInForm
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
