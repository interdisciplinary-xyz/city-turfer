import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { forwardRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { usePalette } from '@/ui-kit/theme';

import type { AccountFieldProps } from './account-settings.constants';
import { useAnnounce } from './use-announce';

/** A labelled text field with its error (announced) or hint underneath; `code` for the 6-digit codes. */
export const AccountField = forwardRef<TextInput, AccountFieldProps>(function AccountField(
  { label, testID, error, hint, code, ...input },
  ref
) {
  const p = usePalette();
  useAnnounce(error);
  const note = error ?? hint ?? null;
  return (
    <View style={s.wrap}>
      <Text style={[s.label, { color: p.muted }]} importantForAccessibility='no'>
        {label}
      </Text>
      <TextInput
        ref={ref}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={p.muted}
        {...(code
          ? {
              keyboardType: 'number-pad' as const,
              textContentType: 'oneTimeCode' as const,
              autoComplete: Platform.OS === 'android' ? ('sms-otp' as const) : ('one-time-code' as const),
              maxLength: 8,
            }
          : {})}
        {...input}
        style={[
          s.input,
          code && s.code,
          { color: p.text, backgroundColor: p.bg, borderColor: error ? p.danger : p.borderControl },
        ]}
      />
      {note && (
        <Text
          testID={`${testID}-${error ? 'error' : 'hint'}`}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={[s.note, { color: error ? p.danger : p.muted }]}
        >
          {note}
        </Text>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { gap: SPACE.xs },
  label: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  input: {
    minHeight: 48,
    fontSize: FONT_SIZE.body,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  code: { fontSize: FONT_SIZE.stat, letterSpacing: 6, textAlign: 'center', fontVariant: ['tabular-nums'] },
  note: { fontSize: FONT_SIZE.caption },
});
