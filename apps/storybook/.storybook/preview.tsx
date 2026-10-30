import '../../web/src/app/globals.css';

import type { Preview } from '@storybook/react-native-web-vite';

import { Frame } from '../src/decorators/frame';
import type { Locale } from '../src/decorators/frame.constants';
import { cityTurferTheme } from './theme';

/** Toolbar: language (website copy). No theme switch: website stories render in WEB_SCHEME (light, like apps/web),
 * every other story in SITE_SCHEME (dark, like the app); the Frame sets both the variables and color-scheme. */
const preview: Preview = {
  globalTypes: {
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
  // A Docs page per component: its description, every story and the prop table.
  tags: ['autodocs'],
  initialGlobals: { locale: 'en' },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    backgrounds: { disable: true },
    docs: { theme: cityTurferTheme },
  },
  decorators: [
    (Story, context) => (
      <Frame
        locale={(context.globals.locale as Locale) ?? 'en'}
        web={context.title.startsWith('Website/')}
        pageLoaded={context.parameters.pageLoaded !== false}
      >
        <Story />
      </Frame>
    ),
  ],
};

export default preview;
