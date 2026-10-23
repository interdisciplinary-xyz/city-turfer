'use client';

import { useTranslations } from 'next-intl';

import type { SignOutButtonProps } from './sign-out-button.constants';

/** Sign out of this browser: in the header of every signed-in page. */
export function SignOutButton({ onSignOut, pending }: SignOutButtonProps) {
  const t = useTranslations('portal.header');
  return (
    <button
      className='portal-button portal-button-secondary portal-sign-out'
      type='button'
      onClick={onSignOut}
      disabled={pending}
    >
      {pending ? t('signingOut') : t('signOut')}
    </button>
  );
}
