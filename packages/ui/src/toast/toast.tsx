import { ACCENT, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/theme';
import { EDGE_WIDTH, GLYPH, MARK_SIZE, MAX_WIDTH, MIN_HEIGHT, type ToastProps } from './toast.constants';

/**
 * A short message about an action the Turfer started: success (accent) or error (danger), each
 * with its own mark, so the two never differ by colour alone. Presentational: the app's toast
 * host places it, queues it and closes it after a while. Errors are an alert (read at once),
 * successes a polite live region.
 */
export function Toast({ variant, message, onDismiss, dismissHint, testID }: ToastProps) {
  const p = usePalette();
  const error = variant === 'error';
  const tone = error ? p.danger : ACCENT;
  const markInk = error ? p.bg : p.onAccent;
  const body = (
    <>
      <View style={[s.edge, { backgroundColor: tone }]} />
      <View style={[s.mark, { backgroundColor: tone }]}>
        <Text style={[s.glyph, { color: markInk }]} importantForAccessibility='no' accessibilityElementsHidden>
          {GLYPH[variant]}
        </Text>
      </View>
      <Text style={[s.message, { color: p.text }]}>{message}</Text>
    </>
  );
  const frame = [s.toast, { backgroundColor: p.card, borderColor: p.borderControl }];
  const live = error ? 'assertive' : 'polite';
  if (onDismiss) {
    return (
      <Pressable
        testID={testID}
        onPress={onDismiss}
        accessibilityRole={error ? 'alert' : 'button'}
        accessibilityLabel={message}
        accessibilityHint={dismissHint}
        accessibilityLiveRegion={live}
        style={({ pressed }) => [frame, pressed && s.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole={error ? 'alert' : 'text'}
      accessibilityLabel={message}
      accessibilityLiveRegion={live}
      style={frame}
    >
      {body}
    </View>
  );
}

const s = StyleSheet.create({
  toast: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    minHeight: MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingLeft: SPACE.lg,
    paddingRight: SPACE.lg,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE_WIDTH },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: FONT_SIZE.unit, fontWeight: FONT_WEIGHT.heavy, lineHeight: MARK_SIZE - 4 },
  message: { flex: 1, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
});
