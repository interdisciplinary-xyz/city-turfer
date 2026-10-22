import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLayoutEffect } from 'react';

import { PageLoader } from '@/app/[locale]/page-loader';
import { PAGE_LOADED_CLASS } from '@/app/[locale]/page-loader/page-loader.constants';

/** The overlay, with `loaded` on <html> toggled as the site's boot script does. */
function PageLoaderDemo({ loaded }: { loaded: boolean }) {
  useLayoutEffect(() => {
    document.documentElement.classList.toggle(PAGE_LOADED_CLASS, loaded);
    return () => document.documentElement.classList.remove(PAGE_LOADED_CLASS);
  }, [loaded]);
  return <PageLoader />;
}

const meta = {
  title: 'Website/PageLoader',
  component: PageLoaderDemo,
  args: { loaded: false },
  argTypes: { loaded: { control: 'boolean', description: 'Page loaded: the overlay fades out' } },
  parameters: {
    // The Frame must not mark the page loaded for this story: the toggle owns that.
    pageLoaded: false,
    docs: {
      description: {
        component:
          'Full-page overlay shown from the first paint until the document is parsed and the fonts are ready (1.5 s at most). It covers the whole viewport, so on the Docs page it covers the docs. Toggle `loaded` to see the fade-out.',
      },
    },
  },
} satisfies Meta<typeof PageLoaderDemo>;

export default meta;

export const Loading: StoryObj<typeof meta> = {};

export const Loaded: StoryObj<typeof meta> = { args: { loaded: true } };
