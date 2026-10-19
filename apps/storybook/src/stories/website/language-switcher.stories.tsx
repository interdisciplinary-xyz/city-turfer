import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { LanguageSwitcher } from '@/app/[locale]/language-switcher';

const meta = {
  title: 'Website/LanguageSwitcher',
  component: LanguageSwitcher,
  args: { locale: 'en' },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'pl'] } },
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;

export const English: StoryObj<typeof meta> = {};

export const Polish: StoryObj<typeof meta> = { args: { locale: 'pl' } };
