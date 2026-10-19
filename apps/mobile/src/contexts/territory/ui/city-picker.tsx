import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { type CityPickerProps, COUNTRY_NAME } from './city-picker.constants';
import { useChooseHomeCity, useCitySearch, useHomeCity } from './hooks';

/**
 * Picks the Home City from the bundled catalogue: the Turf Map opens on it. Search ignores accents
 * ("krakow" finds Kraków). Nothing about the choice leaves the phone.
 */
export function CityPicker({ onDone }: CityPickerProps) {
  const p = usePalette();
  const [query, setQuery] = useState('');
  const cities = useCitySearch(query);
  const home = useHomeCity();
  const choose = useChooseHomeCity();
  const [busy, setBusy] = useState(false);

  const pick = async (cityId: string | null) => {
    setBusy(true);
    try {
      await choose(cityId);
      onDone();
    } catch {
      Alert.alert('Could not save your city', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: p.bg }]}>
      <Text style={[s.lede, { color: p.muted }]}>
        The Turf Map opens on your city. It stays on your phone, like your routes.
      </Text>
      <TextInput
        testID='city-search'
        value={query}
        onChangeText={setQuery}
        placeholder='Search cities'
        placeholderTextColor={p.muted}
        autoCorrect={false}
        autoCapitalize='words'
        clearButtonMode='while-editing'
        returnKeyType='search'
        accessibilityLabel='Search cities'
        style={[s.search, { color: p.text, backgroundColor: p.card, borderColor: p.border }]}
      />
      <FlatList
        data={cities}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text testID='city-empty' style={[s.empty, { color: p.muted }]}>
            No city called “{query.trim()}” yet. CityTurfer knows the biggest Polish and European cities for now.
          </Text>
        }
        renderItem={({ item }) => {
          const selected = home?.id === item.id;
          return (
            <Pressable
              testID={`city-${item.id}`}
              disabled={busy}
              onPress={() => pick(item.id)}
              accessibilityRole='button'
              accessibilityLabel={`${item.name}, ${COUNTRY_NAME[item.country] ?? item.country}`}
              accessibilityState={{ selected, disabled: busy }}
              style={({ pressed }) => [
                s.row,
                { backgroundColor: p.card, borderColor: selected ? ACCENT : p.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={s.rowText}>
                <Text style={[s.name, { color: p.text }]}>{item.name}</Text>
                <Text style={[s.country, { color: p.muted }]}>{COUNTRY_NAME[item.country] ?? item.country}</Text>
              </View>
              {selected ? <Text style={[s.check, { color: ACCENT }]}>✓</Text> : null}
            </Pressable>
          );
        }}
      />
      {home ? (
        <Button
          testID='city-clear'
          label={`Clear ${home.name}`}
          color={p.card}
          textColor={p.text}
          disabled={busy}
          onPress={() => pick(null)}
          style={s.clear}
        />
      ) : null}
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
  check: { fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.heavy },
  empty: { fontSize: FONT_SIZE.caption, textAlign: 'center', marginTop: SPACE.xl },
  clear: { marginBottom: SPACE.xxl },
});
