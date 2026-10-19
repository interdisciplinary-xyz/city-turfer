import { ACCENT, FONT_SIZE, RADIUS, SPACE, TIER_COLOR, TIER_LABEL, TIER_ORDER, TYPE_COLOR } from '@cityturfer/brand';
import { usePalette } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

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

/** Every token from @cityturfer/brand, for the scheme chosen in the toolbar. */
function Tokens() {
  const p = usePalette();
  return (
    <View>
      <Section title='Turf strength ramp (the brand palette)'>
        {TIER_ORDER.map((t) => (
          <Swatch key={t} name={TIER_LABEL[t]} value={TIER_COLOR[t]} />
        ))}
        <Swatch name='Accent' value={ACCENT} />
      </Section>
      <Section title='Activity types'>
        <Swatch name='Walk' value={TYPE_COLOR.walk} />
        <Swatch name='Run' value={TYPE_COLOR.run} />
        <Swatch name='Ride' value={TYPE_COLOR.cycle} />
      </Section>
      <Section title='Theme'>
        {Object.entries(p).map(([name, value]) => (
          <Swatch key={name} name={name} value={value} />
        ))}
      </Section>
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
          <Text key={name} style={{ color: p.text, fontSize: value, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
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
          'One source for both apps: the app reads these in TS, the website gets them as CSS variables from `cssVariables()`.',
      },
    },
  },
} satisfies Meta<typeof Tokens>;

export default meta;

export const All: StoryObj<typeof meta> = {};
