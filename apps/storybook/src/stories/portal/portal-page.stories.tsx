import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale } from 'next-intl';

import { AccountSummary, BackupStatus, DeleteAccount, DevicesPanel, ExportPanel, WhatWeStore } from '@/domains/account';
import { SignInForm } from '@/domains/auth';
import { PortalFrame, SignOutButton } from '@/domains/portal';
import type { Locale } from '@/i18n/routing';

import { after, CONSENTS, ERRORS, SESSIONS, USER } from './fixtures';

type Props = { page: 'privacy' | 'sign-in' };

/** Whole portal pages from their pieces (the real pages add the data hooks and the session gate). */
function PortalPage({ page }: Props) {
  const locale = useLocale() as Locale;
  if (page === 'sign-in') {
    return (
      <PortalFrame locale={locale} path='/account/sign-in'>
        <SignInForm onRequestCode={after(600, 'ok')} onSignIn={after(800, ERRORS.wrongCode)} />
      </PortalFrame>
    );
  }
  return (
    <PortalFrame
      locale={locale}
      path='/account'
      headerActions={<SignOutButton onSignOut={() => undefined} pending={false} />}
    >
      <div className='portal-page'>
        <AccountSummary user={USER} locale={locale} />
        <BackupStatus consents={CONSENTS.on} locale={locale} />
        <WhatWeStore />
        <ExportPanel
          email={USER.email}
          locale={locale}
          job={null}
          onRequest={() => undefined}
          pending={false}
          error={null}
        />
        <DevicesPanel
          sessions={SESSIONS}
          loading={false}
          locale={locale}
          onRevoke={() => undefined}
          onRevokeScope={() => undefined}
          pending={null}
          error={null}
        />
        <DeleteAccount onDelete={() => undefined} pending={false} error={null} />
      </div>
    </PortalFrame>
  );
}

const meta = {
  title: 'Portal/Pages',
  component: PortalPage,
  args: { page: 'privacy' },
  argTypes: { page: { control: 'inline-radio', options: ['privacy', 'sign-in'] } },
} satisfies Meta<typeof PortalPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrivacyAndData: Story = { name: 'Privacy & data' };
export const SignIn: Story = { args: { page: 'sign-in' } };
