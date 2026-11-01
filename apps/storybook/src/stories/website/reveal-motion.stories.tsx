import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { RevealMotion } from '@/app/[locale]/reveal-motion';

/** A few `data-reveal` blocks down a tall page: scroll and each one rises and fades in once. */
function RevealDemo() {
  return (
    <>
      <RevealMotion />
      <div style={{ padding: 24 }}>
        <p style={{ margin: 0, color: 'var(--muted)' }}>Scroll down.</p>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} data-reveal='' className='app-card' style={{ marginTop: '70vh' }}>
            <h3 className='app-card-title'>Card {n}</h3>
            <p className='home-step-body'>Appears once, as it nears the viewport. Reduced motion shows it at once.</p>
          </div>
        ))}
        <div style={{ height: '60vh' }} />
      </div>
    </>
  );
}

const meta = {
  title: 'Website/RevealMotion',
  component: RevealDemo,
  parameters: {
    docs: {
      description: {
        component:
          'Scroll-in for section heads and cards (GSAP ScrollTrigger.batch, once). Renders nothing itself; elements opt in with data-reveal. Off with reduced motion.',
      },
    },
  },
} satisfies Meta<typeof RevealDemo>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
