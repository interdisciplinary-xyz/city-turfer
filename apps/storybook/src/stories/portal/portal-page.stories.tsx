import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale } from 'next-intl';

import { AccountSummary } from '@/app/[locale]/account/_portal/account-summary';
import { BackupStatus } from '@/app/[locale]/account/_portal/backup-status';
import { DeleteAccount } from '@/app/[locale]/account/_portal/delete-account';
import { DevicesPanel } from '@/app/[locale]/account/_portal/devices-panel';
import { ExportPanel } from '@/app/[locale]/account/_portal/export-panel';
import { PortalFrame } from '@/app/[locale]/account/_portal/portal-frame';
import { SignInForm } from '@/app/[locale]/account/_portal/sign-in-form';
import { SignOutButton } from '@/app/[locale]/account/_portal/sign-out-button';
import { WhatWeStore } from '@/app/[locale]/account/_portal/what-we-store';
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
  globals: { scheme: 'light' },
  args: { page: 'privacy' },
  argTypes: { page: { control: 'inline-radio', options: ['privacy', 'sign-in'] } },
} satisfies Meta<typeof PortalPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrivacyAndData: Story = { name: 'Privacy & data' };
export const SignIn: Story = { args: { page: 'sign-in' } };
