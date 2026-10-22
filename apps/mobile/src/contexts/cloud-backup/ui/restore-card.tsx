import { FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { useRestore } from './hooks';
import { describeOffer, describeProgress, describeResult, RESTORE_TITLE } from './restore-card.constants';

/** Home screen card on a phone whose account has a backup but no activities yet: Restore / Not now. */
export function RestoreCard() {
  const p = usePalette();
  const { offer, progress, result, running, start, dismiss } = useRestore();
  const message = describeResult(result);
  const offered = offer && offer.kind !== 'none' ? offer : null;
  if (!offered && !message) {
    return null;
  }
  const done = result?.kind === 'done';
  return (
    <Card testID='restore-card' style={{ gap: SPACE.md }}>
      <Text style={[s.h2, { color: p.text }]}>{RESTORE_TITLE}</Text>
      {offered && !done && <Text style={{ color: p.muted }}>{describeOffer(offered)}</Text>}
      {running && (
        <Text testID='restore-progress' style={{ color: p.text }}>
          {describeProgress(progress)}
        </Text>
      )}
      {message && !running && (
        <Text testID='restore-message' style={{ color: done ? p.text : p.muted }}>
          {message}
        </Text>
      )}
      <View style={s.row}>
        {offered && !done && (
          <Button testID='restore-start' label='Restore' color={ACCENT} busy={running} onPress={() => void start()} />
        )}
        {!running && (
          <Button
            testID='restore-dismiss'
            label={done ? 'Done' : 'Not now'}
            color={p.border}
            textColor={p.text}
            onPress={dismiss}
          />
        )}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: FONT_WEIGHT.heavy },
  row: { flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' },
});
