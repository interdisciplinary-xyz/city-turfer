import {
  ACCENT,
  DARK,
  FONT_FAMILY,
  FONT_SIZE,
  RADIUS,
  SITE_SCHEME,
  SPACE,
  THEMES,
  TIER_COLOR,
  TIER_LABEL,
  TIER_ORDER,
  TYPE_COLOR,
} from '@cityturfer/brand';
import { usePalette } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { NightPanel } from '../../decorators/frame';

function Swatch({ name, value }: { name: string; value: string }) {
  const p = usePalette();
  return (
    <View style={{ width: 120, gap: 4 }}>
      <View
        style={{ height: 56, borderRadius: RADIUS.chip, backgroundColor: value, borderWidth: 1, borderColor: p.border }}
      />
      <Text style={{ color: p.text, fontWeight: '700', fontSize: 13 }}>{name}</Text>
      <Text style={{ color: p.muted, fontSize: 12, fontFamily: 'monospace' }}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ gap: 12, marginBottom: 28 }}>
      <Text style={{ color: p.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{children}</View>
    </View>
  );
}

/** The six base roles; every other Palette key is a text or graphic variant of a brand fill. */
const BASE_KEYS = new Set(['bg', 'card', 'text', 'muted', 'border', 'danger']);

/** Every token from @cityturfer/brand: the site's light theme, then the app's dark one on night. */
function Tokens() {
  const p = usePalette();
  const site = THEMES[SITE_SCHEME];
  const entries = Object.entries(site);
  return (
    <View>
      <Section title='Turf strength ramp (the brand palette; fills only on light)'>
        {TIER_ORDER.map((t) => (
          <Swatch key={t} name={TIER_LABEL[t]} value={TIER_COLOR[t]} />
        ))}
        <Swatch name='Accent' value={ACCENT} />
      </Section>
      <Section title='Activity types (fills; text and lines use the variants below)'>
        <Swatch name='Walk' value={TYPE_COLOR.walk} />
        <Swatch name='Run' value={TYPE_COLOR.run} />
        <Swatch name='Ride' value={TYPE_COLOR.cycle} />
      </Section>
      <Section title={`Theme: ${SITE_SCHEME} (website, Swagger, Storybook)`}>
        {entries
          .filter(([name]) => BASE_KEYS.has(name))
          .map(([name, value]) => (
            <Swatch key={name} name={name} value={value} />
          ))}
      </Section>
      <Section title={`Theme: ${SITE_SCHEME}, AA variants (text ≥ 4.5:1, graphics and edges ≥ 3:1)`}>
        {entries
          .filter(([name]) => !BASE_KEYS.has(name))
          .map(([name, value]) => (
            <Swatch key={name} name={name} value={value} />
          ))}
      </Section>
      <View style={{ marginBottom: 28 }}>
        <NightPanel>
          <Section title='Theme: dark (the app and every map; added keys repeat the brand fills)'>
            {Object.entries(DARK).map(([name, value]) => (
              <Swatch key={name} name={name} value={value} />
            ))}
          </Section>
        </NightPanel>
      </View>
      <Section title='Spacing'>
        {Object.entries(SPACE).map(([name, value]) => (
          <View key={name} style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ width: value, height: value, backgroundColor: ACCENT, borderRadius: 2 }} />
            <Text style={{ color: p.muted, fontSize: 12 }}>
              {name} · {value}
            </Text>
          </View>
        ))}
      </Section>
      <Section title='Radii'>
        {Object.entries(RADIUS).map(([name, value]) => (
          <View key={name} style={{ alignItems: 'center', gap: 4 }}>
            <View
              style={{ width: 64, height: 48, borderRadius: Math.min(value, 24), borderWidth: 2, borderColor: p.text }}
            />
            <Text style={{ color: p.muted, fontSize: 12 }}>
              {name} · {value}
            </Text>
          </View>
        ))}
      </Section>
      <Section title='Type scale'>
        {Object.entries(FONT_SIZE).map(([name, value]) => (
          <Text
            key={name}
            style={{ color: p.text, fontSize: value, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] }}
          >
            {name} {value}
          </Text>
        ))}
      </Section>
    </View>
  );
}

const meta = {
  title: 'Foundations/Tokens',
  component: Tokens,
  parameters: {
    docs: {
      description: {
        component:
          'One source for both apps: the app reads these in TS (dark), the website gets them as CSS variables from `cssVariables(SITE_SCHEME)` (light). On light, brand fills stay fills; text and lines use the `-Text` / `-Graphic` keys (`docs/decisions/brand-light-theme-2026-10-22.md`).',
      },
    },
  },
} satisfies Meta<typeof Tokens>;

export default meta;

export const All: StoryObj<typeof meta> = {};
