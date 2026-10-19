import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale } from 'next-intl';

import { WaitlistForm } from '@/app/[locale]/waitlist-form';

/** The waitlist section; the form posts to an address that never answers, so no one is signed up. */
function Waitlist() {
  const locale = useLocale();
  return (
    <section className='waitlist-section'>
      <div className='wrap'>
        <WaitlistForm
          action='https://example.invalid/brevo'
          controller='CityTurfer (example)'
          contactEmail='privacy@example.invalid'
          locale={locale}
        />
      </div>
    </section>
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
