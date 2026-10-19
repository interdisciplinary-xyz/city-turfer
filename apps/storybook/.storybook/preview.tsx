import '../../web/src/app/globals.css';

import type { Preview } from '@storybook/react-native-web-vite';

import { Frame } from '../src/decorators/frame';
import type { Locale } from '../src/decorators/frame.constants';

/** Toolbar: colour scheme (app components; the website is always dark) and language (website). */
const preview: Preview = {
  globalTypes: {
    scheme: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Language (website copy)',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'pl', title: 'Polski' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { scheme: 'dark', locale: 'en' },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    backgrounds: { disable: true },
  },
  decorators: [
    (Story, context) => (
      <Frame
        scheme={context.globals.scheme === 'light' ? 'light' : 'dark'}
        locale={(context.globals.locale as Locale) ?? 'en'}
        web={context.title.startsWith('Website/')}
      >
        <Story />
      </Frame>
    ),
  ],
};

export default preview;
