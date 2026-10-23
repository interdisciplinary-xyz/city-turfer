import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FONT_FAMILY, TIER_COLOR } from '@/constants/colors';
import { useT } from '@/i18n';
import { Card } from '@/ui-kit/components';
import { fixed, formatArea } from '@/ui-kit/format';
import { usePalette } from '@/ui-kit/theme';

import type { ClaimView } from '../contract';

export function TurfGainedCard({ claim }: { claim: ClaimView | null }) {
  const p = usePalette();
  const t = useT('turf');
  const reinforced = claim ? claim.cellCount - claim.newCellCount : 0;
  return (
    <Card style={{ borderColor: TIER_COLOR.glowing, borderWidth: 1.5 }}>
      <Text style={[s.h, { color: p.text }]}>{t('gained.title')}</Text>
      {claim ? (
        <View style={{ gap: 2 }} testID='turf-gained'>
          <Text style={[s.big, { color: TIER_COLOR.glowing }]}>
            {t('gained.newTurf', { area: formatArea(claim.newAreaKm2) })}
          </Text>
          <Text style={{ color: p.muted }}>
            {t('gained.cells', {
              addedCount: claim.newCellCount,
              added: fixed(claim.newCellCount, 0),
              reinforcedCount: reinforced,
              reinforced: fixed(reinforced, 0),
            })}
          </Text>
        </View>
      ) : (
        <View style={s.row}>
          <ActivityIndicator />
          <Text style={{ color: p.muted }}>{t('gained.claiming')}</Text>
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
