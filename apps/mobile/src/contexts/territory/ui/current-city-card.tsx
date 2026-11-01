import { DISPLAY_CASE, DISPLAY_TRACKING, FONT_SIZE, FONT_WEIGHT, SPACE } from '@cityturfer/brand';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, FONT_FAMILY, TIER_COLOR } from '@/constants/colors';
import { useT } from '@/i18n';
import { Button, Card } from '@/ui-kit/components';
import { fixed, formatArea } from '@/ui-kit/format';
import { usePalette } from '@/ui-kit/theme';

import { CITY_CARD_BAR, CITY_CARD_TOP, type CurrentCityCardProps } from './current-city-card.constants';
import { shareBarWidth, shareText } from './district-share';
import { useDistricts } from './hooks';
import { useCityName } from './use-city-names';

/**
 * Dashboard card for the Home City: how many of its districts hold turf, the turf in it, and the
 * districts with the most, each with its share. Opens the Districts screen. Without a Home City it
 * offers the picker; while the districts load (or if they can't) it shows nothing.
 */
export function CurrentCityCard({ onOpenDistricts, onPickCity }: CurrentCityCardProps) {
  const p = usePalette();
  const t = useT('turf');
  const cityName = useCityName();
  const view = useDistricts();
  if (!view) {
    return null;
  }
  if (view.status === 'no-city') {
    return (
      <Card style={s.card} testID='dashboard-city'>
        <Text style={[s.title, { color: p.text }]}>{t('cityCard.title')}</Text>
        <Text style={[s.muted, { color: p.muted }]}>{t('cityCard.noCity')}</Text>
        <Button testID='dashboard-city-choose' label={t('chooseCity')} onPress={onPickCity} />
      </Card>
    );
  }
  const name = cityName(view.city);
  if (view.status === 'no-data') {
    return (
      <Card style={s.card} testID='dashboard-city'>
        <Text style={[s.title, { color: p.text }]}>{t('cityCard.title')}</Text>
        <Text style={[s.city, { color: p.text }]}>{name}</Text>
        <Text style={[s.muted, { color: p.muted }]}>{t('cityCard.noData', { city: name })}</Text>
      </Card>
    );
  }
  const total = view.districts.length;
  const lit = view.districts.filter((d) => d.cellCount > 0);
  const counts = { withTurf: fixed(lit.length, 0), total: fixed(total, 0) };
  const area = formatArea(view.coveredKm2);
  const top = lit.slice(0, CITY_CARD_TOP);
  return (
    <Pressable
      testID='dashboard-city'
      onPress={onOpenDistricts}
      accessibilityRole='button'
      accessibilityLabel={t('cityCard.label', { city: name, area, ...counts })}
      accessibilityHint={t('cityCard.hint')}
    >
      <Card style={s.card}>
        <View style={s.header}>
          <Text style={[s.title, { color: p.text }]}>{t('cityCard.title')}</Text>
          <Text style={s.count} testID='dashboard-city-districts'>
            {t('cityCard.districts', counts)}
          </Text>
        </View>
        <Text style={[s.city, { color: p.text }]} testID='dashboard-city-name'>
          {name}
        </Text>
        <View style={[s.track, { height: CITY_CARD_BAR.city, backgroundColor: p.border }]}>
          <View style={[s.fill, { width: shareBarWidth(total > 0 ? lit.length / total : 0, CITY_CARD_BAR.minPct) }]} />
        </View>
        <Text style={[s.muted, { color: p.muted }]}>
          {top.length > 0 ? t('cityCard.summary', { area, district: top[0].name }) : t('cityCard.summaryNone')}
        </Text>
        {top.map((d) => (
          <View key={d.id} style={s.district}>
            <Text style={[s.districtName, { color: p.text }]} numberOfLines={1}>
              {d.name}
            </Text>
            <View style={[s.track, s.districtTrack, { height: CITY_CARD_BAR.district, backgroundColor: p.border }]}>
              <View style={[s.fill, { width: shareBarWidth(d.share, CITY_CARD_BAR.minPct) }]} />
            </View>
            <Text style={[s.percent, { color: p.muted }]}>{shareText(d.share)}</Text>
          </View>
        ))}
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { gap: SPACE.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.sm },
  title: { fontSize: 17, fontWeight: FONT_WEIGHT.heavy },
  count: { color: ACCENT, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] },
  city: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.stat,
    textTransform: DISPLAY_CASE,
    letterSpacing: DISPLAY_TRACKING,
  },
  muted: { fontSize: FONT_SIZE.caption },
  track: { borderRadius: CITY_CARD_BAR.city / 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: CITY_CARD_BAR.city / 2, backgroundColor: TIER_COLOR.glowing },
  district: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  districtName: { flex: 2, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  districtTrack: { flex: 3 },
  percent: {
    minWidth: 36,
    textAlign: 'right',
    fontFamily: FONT_FAMILY.numeric,
    fontSize: FONT_SIZE.label,
    fontVariant: ['tabular-nums'],
  },
});
