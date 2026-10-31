import { BODY_FONT_FAMILY, DISPLAY_CASE, DISPLAY_TRACKING, FONT_FAMILY } from '@cityturfer/brand';
import { usePalette } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text, View } from 'react-native';

import { DISPLAY_SIZES, SAMPLES } from './typography.constants';

/** The small uppercase caption above each typeface. */
function Caption({ children }: { children: string }) {
  const p = usePalette();
  return <Text style={[s.caption, { color: p.muted }]}>{children}</Text>;
}

/**
 * The "Street Plate" pairing with sample strings: display in capitals, numbers with tabular
 * figures; app body text stays on the system font, the website's is Barlow.
 */
function Typography() {
  const p = usePalette();
  const display = [s.display, { color: p.text }];
  const numeric = [s.numeric, { color: p.text }];
  return (
    <View style={s.page}>
      <View style={s.group}>
        <Caption>{`Display · ${FONT_FAMILY.display} · capitals`}</Caption>
        <Text style={[display, { fontSize: DISPLAY_SIZES.hero, lineHeight: DISPLAY_SIZES.hero * 1.05 }]}>
          {SAMPLES.brand}
        </Text>
        <Text style={[display, { fontSize: DISPLAY_SIZES.h1, lineHeight: DISPLAY_SIZES.h1 + 3 }]}>{SAMPLES.title}</Text>
        <Text style={[display, { fontSize: DISPLAY_SIZES.header, lineHeight: DISPLAY_SIZES.header + 4 }]}>
          {SAMPLES.polish}
        </Text>
      </View>
      <View style={s.group}>
        <Caption>{`Numeric · ${FONT_FAMILY.numeric} · tabular figures`}</Caption>
        <Text style={[numeric, { fontSize: 52 }]}>{SAMPLES.distance}</Text>
        <Text style={[numeric, { fontSize: 30 }]}>{`${SAMPLES.time}   ${SAMPLES.pace}`}</Text>
        <Text style={[numeric, { fontSize: 30 }]}>{SAMPLES.area}</Text>
        <Text style={[numeric, { fontSize: 22 }]}>{SAMPLES.polish}</Text>
      </View>
      <View style={s.group}>
        <Caption>Body and labels in the app · system font</Caption>
        <Text style={{ color: p.text, fontSize: 16 }}>{SAMPLES.body}</Text>
        <Text style={{ color: p.text, fontSize: 16 }}>{SAMPLES.polish}</Text>
      </View>
      <View style={s.group}>
        <Caption>{`Body on the website · ${BODY_FONT_FAMILY} 400 / 500 / 600 / 700`}</Caption>
        <Text style={[s.web, { color: p.text }]}>{SAMPLES.body}</Text>
        {(['400', '500', '600', '700'] as const).map((weight) => (
          <Text key={weight} style={[s.web, { color: p.text, fontWeight: weight }]}>
            {`${weight} · ${SAMPLES.polish}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { gap: 28 },
  group: { gap: 8 },
  caption: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  display: { fontFamily: FONT_FAMILY.display, textTransform: DISPLAY_CASE, letterSpacing: DISPLAY_TRACKING },
  numeric: { fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] },
  // Barlow is a family of static weights (web @font-face), so here fontWeight picks the file.
  web: { fontFamily: BODY_FONT_FAMILY, fontSize: 16 },
});

const meta = {
  title: 'Foundations/Typography',
  component: Typography,
  parameters: {
    docs: {
      description: {
        component:
          '"Street Plate": Big Shoulders Display Black for screen titles, always in capitals (`DISPLAY_CASE`, `DISPLAY_TRACKING`), and Barlow Semi Condensed ExtraBold for big numbers with tabular figures. Both OFL, static fonts with the weight baked in, so never combine them with `fontWeight`. In the app body text and labels stay on the system font; the website sets them in Barlow. The wordmark is the one exception: outlined Anton in capitals, one solid colour (white on night).',
      },
    },
  },
} satisfies Meta<typeof Typography>;

export default meta;

export const Typefaces: StoryObj<typeof meta> = {};
