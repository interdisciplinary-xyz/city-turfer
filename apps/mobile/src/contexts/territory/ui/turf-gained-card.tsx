import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FONT_FAMILY, TIER_COLOR } from '@/constants/colors';
import { Card } from '@/ui-kit/components';
import { formatArea } from '@/ui-kit/format';
import { usePalette } from '@/ui-kit/theme';

import type { ClaimView } from '../contract';

export function TurfGainedCard({ claim }: { claim: ClaimView | null }) {
  const p = usePalette();
  return (
    <Card style={{ borderColor: TIER_COLOR.glowing, borderWidth: 1.5 }}>
      <Text style={[s.h, { color: p.text }]}>Turf gained</Text>
      {claim ? (
        <View style={{ gap: 2 }} testID='turf-gained'>
          <Text style={[s.big, { color: TIER_COLOR.glowing }]}>+{formatArea(claim.newAreaKm2)} new turf</Text>
          <Text style={{ color: p.muted }}>
            {claim.newCellCount} new cells · {claim.cellCount - claim.newCellCount} reinforced
          </Text>
        </View>
      ) : (
        <View style={s.row}>
          <ActivityIndicator />
          <Text style={{ color: p.muted }}>Claiming your turf…</Text>
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  h: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  big: { fontSize: 22, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
