import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale } from 'next-intl';

import { AccountSummary } from '@/app/[locale]/account/_portal/account-summary';
import { BackupStatus } from '@/app/[locale]/account/_portal/backup-status';
import { WhatWeStore } from '@/app/[locale]/account/_portal/what-we-store';

import { CONSENTS, USER } from './fixtures';

type Props = { backup: keyof typeof CONSENTS; withEmail: boolean };

/** The read-only sections of Privacy & data: account, backup consents (D5: changed in the app) and what we store. */
function PrivacySections({ backup, withEmail }: Props) {
  const locale = useLocale();
  return (
    <div className='portal-page'>
      <AccountSummary user={withEmail ? USER : { ...USER, email: null }} locale={locale} />
      <BackupStatus consents={CONSENTS[backup]} locale={locale} />
      <WhatWeStore />
    </div>
  );
}

const meta = {
  title: 'Portal/PrivacySections',
  component: PrivacySections,
  args: { backup: 'on', withEmail: true },
  argTypes: { backup: { control: 'inline-radio', options: Object.keys(CONSENTS) } },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PrivacySections>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BackupOn: Story = { name: 'Backup on, Apple Health not shared' };

export const BackupOnWithHealth: Story = { name: 'Backup on, Apple Health shared', args: { backup: 'onWithHealth' } };

export const BackupNeverOn: Story = { name: 'Backup never turned on', args: { backup: 'never' } };

export const BackupWithdrawn: Story = { name: 'Backup withdrawn (copy erased)', args: { backup: 'withdrawn' } };

export const NoEmail: Story = { name: 'Device-token account (no e-mail)', args: { withEmail: false } };
