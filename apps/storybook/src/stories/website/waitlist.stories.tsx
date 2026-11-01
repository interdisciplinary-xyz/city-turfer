import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale, useTranslations } from 'next-intl';

import { Section, SectionHead } from '@/app/[locale]/home-sections';
import { WaitlistForm } from '@/app/[locale]/waitlist-form';

/** The waitlist section; the form posts to an address that never answers, so no one is signed up. */
function Waitlist() {
  const locale = useLocale();
  const t = useTranslations('waitlist');
  return (
    <Section name='waitlist' className='waitlist-section'>
      <SectionHead name='waitlist' eyebrow={t('eyebrow')} title={t('title')} align='center' />
      <WaitlistForm
        action='https://example.invalid/brevo'
        controller='CityTurfer (example)'
        contactEmail='privacy@example.invalid'
        locale={locale}
        headingId='waitlist-title'
      />
    </Section>
  );
}

const meta = {
  title: 'Website/Waitlist',
  component: Waitlist,
  parameters: {
    docs: {
      description: {
        component:
          'Brevo double opt-in form. Shown only when the NEXT_PUBLIC_WAITLIST_* variables are set. Here it posts nowhere real.',
      },
    },
  },
} satisfies Meta<typeof Waitlist>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
