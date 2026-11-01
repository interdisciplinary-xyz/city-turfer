import { APP_SCHEME, cssVariables } from '@cityturfer/brand';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { CSSProperties } from 'react';

import { Icon, ICON_FOR_TYPE, ICON_NAMES } from '@/app/[locale]/icons';

const SIZES = [20, 24, 32, 48] as const;

/** A night panel as the site draws one: the app's variables inline, so the tokens resolve to dark. */
const NIGHT: CSSProperties = {
  ...(cssVariables(APP_SCHEME) as CSSProperties),
  background: 'var(--bg)',
  color: 'var(--text)',
  borderRadius: 'var(--radius-panel)',
  padding: 'var(--space-lg)',
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(176px, 1fr))',
  gap: 'var(--space-md)',
};
const cell: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm)',
};
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-md)' };
const label: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 'var(--font-label)',
  letterSpacing: 'var(--label-tracking)',
};
const heading: CSSProperties = {
  margin: '0 0 var(--space-md)',
  fontSize: 'var(--font-label)',
  textTransform: 'uppercase',
};

/** Every icon at 20, 24, 32 and 48 px in the surface's text colour, then on accent and activity discs. */
function IconSheet({ title }: { title: string }) {
  return (
    <div>
      <p style={heading}>{title}</p>
      <div style={grid}>
        {ICON_NAMES.map((name) => (
          <div key={name} style={cell}>
            <div style={row}>
              {SIZES.map((size) => (
                <Icon key={size} name={name} size={size} />
              ))}
            </div>
            <div style={{ ...row, color: 'var(--accent-text)' }}>
              <span className='icon-disc'>
                <Icon name={name} />
              </span>
            </div>
            <span style={label}>{name}</span>
          </div>
        ))}
      </div>
      <div style={{ ...row, marginTop: 'var(--space-lg)' }}>
        {(['walk', 'run', 'cycle'] as const).map((type) => {
          const name = ICON_FOR_TYPE[type];
          return (
            <span key={type} style={row}>
              <span className={`icon-disc icon-disc-${name}`}>
                <Icon name={name} />
              </span>
              <Icon name={name} size={20} className={`icon-${name}`} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function IconSet() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <IconSheet title='Light page (WEB_SCHEME)' />
      <div style={NIGHT}>
        <IconSheet title='Night panel (APP_SCHEME)' />
      </div>
    </div>
  );
}

const meta = {
  title: 'Website/Icons',
  component: IconSet,
  parameters: {
    docs: {
      description: {
        component:
          "The marketing pages' outline icons (apps/web/src/app/[locale]/icons): one 24 × 24 grid, 1.75 stroke, round caps and joins, the mark's line. Inline SVG in currentColor, decorative unless given a title. Discs (.icon-disc, -walk / -run / -ride) tint the icon's own token 12% and draw it in the -text token; bare activity icons use the -graphic tokens. No turf tier colours on the light page.",
      },
    },
  },
} satisfies Meta<typeof IconSet>;

export default meta;

export const AllIcons: StoryObj<typeof meta> = {};

export const Labelled: StoryObj<typeof meta> = {
  render: () => (
    <p style={{ ...row, color: 'var(--accent-text)' }}>
      <Icon name='lock' title='Private by default' />
      <span style={{ color: 'var(--text)' }}>An icon that carries meaning gets a title (role img).</span>
    </p>
  ),
};
