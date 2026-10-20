import { FONT_FAMILY } from '@cityturfer/brand';
import { usePalette } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';

import { SAMPLES } from './typography.constants';

/** The two brand typefaces with sample strings; body text and labels stay on the system font. */
function Typography() {
  const p = usePalette();
  return (
    <View style={{ gap: 28 }}>
      <View style={{ gap: 8 }}>
        <Text
          style={{ color: p.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}
        >
          Display · {FONT_FAMILY.display}
        </Text>
        <Text style={{ color: p.text, fontSize: 34, letterSpacing: -1, fontFamily: FONT_FAMILY.display }}>
          {SAMPLES.brand}
        </Text>
        <Text style={{ color: p.text, fontSize: 28, letterSpacing: -0.5, fontFamily: FONT_FAMILY.display }}>
          {SAMPLES.polish}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text
          style={{ color: p.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}
        >
          Numeric · {FONT_FAMILY.numeric} (tabular figures)
        </Text>
        <Text style={{ color: p.text, fontSize: 52, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] }}>
          {SAMPLES.distance}
        </Text>
        <Text style={{ color: p.text, fontSize: 30, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] }}>
          {SAMPLES.area}
        </Text>
        <Text style={{ color: p.text, fontSize: 22, fontFamily: FONT_FAMILY.numeric }}>{SAMPLES.polish}</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text
          style={{ color: p.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}
        >
          Body and labels · system font
        </Text>
        <Text style={{ color: p.text, fontSize: 16 }}>{SAMPLES.polish}</Text>
      </View>
    </View>
  );
}

const meta = {
  title: 'Foundations/Typography',
  component: Typography,
  parameters: {
    docs: {
      description: {
        component:
          'Archivo (OFL), two static fonts: Expanded Black for the logo and screen titles, ExtraBold for big numbers. The weight is baked in, so never combine them with `fontWeight`.',
      },
    },
  },
} satisfies Meta<typeof Typography>;

export default meta;

export const Typefaces: StoryObj<typeof meta> = {};
