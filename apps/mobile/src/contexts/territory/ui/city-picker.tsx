import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useLocale, useT } from '@/i18n';
import { Button } from '@/ui-kit/components';
import { AppSymbol } from '@/ui-kit/symbol';
import { usePalette } from '@/ui-kit/theme';

import { cityName, countryName } from './city-names';
import type { CityPickerProps } from './city-picker.constants';
import { useChooseHomeCity, useHomeCity } from './hooks';
import { useCitySearchInAllLanguages } from './use-city-names';

/**
 * Picks the Home City from the bundled catalogue: the Turf Map opens on it. Cities show in the app
 * language; search matches their names in every app language and ignores accents ("krakow" finds
 * Kraków, "warszawa" Warsaw). The search never leaves the phone; the chosen city's id is backed up
 * only when Cloud backup is on.
 */
export function CityPicker({ onDone }: CityPickerProps) {
  const p = usePalette();
  const t = useT('cities');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const cities = useCitySearchInAllLanguages(query);
  const home = useHomeCity();
  const choose = useChooseHomeCity();
  const [busy, setBusy] = useState(false);

  const pick = async (cityId: string | null) => {
    setBusy(true);
    try {
      await choose(cityId);
      onDone();
    } catch {
      Alert.alert(t('picker.saveFailedTitle'), t('picker.saveFailedBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: p.bg }]}>
      <Text style={[s.lede, { color: p.muted }]}>{t('picker.lede')}</Text>
      <TextInput
        testID='city-search'
        value={query}
        onChangeText={setQuery}
        placeholder={t('picker.searchPlaceholder')}
        placeholderTextColor={p.muted}
        autoCorrect={false}
        autoCapitalize='words'
        clearButtonMode='while-editing'
        returnKeyType='search'
        accessibilityLabel={t('picker.searchLabel')}
        style={[s.search, { color: p.text, backgroundColor: p.card, borderColor: p.border }]}
      />
      {home ? (
        <Button
          testID='city-clear'
          label={t('picker.clear', { city: cityName(home, locale) })}
          color={p.card}
          textColor={p.text}
          disabled={busy}
          onPress={() => pick(null)}
          style={s.clear}
        />
      ) : null}
      <FlatList
        data={cities}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps='handled'
        keyboardDismissMode='on-drag'
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text testID='city-empty' style={[s.empty, { color: p.muted }]}>
            {t('picker.empty', { query: query.trim() })}
          </Text>
        }
        extraData={locale}
        renderItem={({ item }) => {
          const selected = home?.id === item.id;
          const name = cityName(item, locale);
          const country = countryName(item.country, locale);
          return (
            <Pressable
              testID={`city-${item.id}`}
              disabled={busy}
              onPress={() => pick(item.id)}
              accessibilityRole='button'
              accessibilityLabel={t('picker.rowLabel', { city: name, country })}
              accessibilityState={{ selected, disabled: busy }}
              style={({ pressed }) => [
                s.row,
                { backgroundColor: p.card, borderColor: selected ? ACCENT : p.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={s.rowText}>
                <Text style={[s.name, { color: p.text }]}>{name}</Text>
                <Text style={[s.country, { color: p.muted }]}>{country}</Text>
              </View>
              {selected ? <AppSymbol name='checkmark' fallback='✓' size={FONT_SIZE.lead} color={ACCENT} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },
  lede: { fontSize: FONT_SIZE.caption, marginBottom: SPACE.md },
  search: {
    fontSize: FONT_SIZE.body,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    marginBottom: SPACE.md,
  },
  list: { gap: SPACE.sm, paddingBottom: SPACE.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACE.md,
    borderRadius: RADIUS.control,
    borderWidth: 1.5,
  },
  rowText: { flex: 1 },
  name: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  country: { fontSize: FONT_SIZE.caption },
  empty: { fontSize: FONT_SIZE.caption, textAlign: 'center', marginTop: SPACE.xl },
  clear: { marginBottom: SPACE.md },
});
