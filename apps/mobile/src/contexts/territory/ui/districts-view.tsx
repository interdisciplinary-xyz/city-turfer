import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { Camera, type CameraRef, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, DARK, FONT_FAMILY, TIER_COLOR } from '@/constants/colors';
import { MAP_STYLE_DARK } from '@/constants/map';
import { useT } from '@/i18n';
import type { BoundingBox } from '@/shared-kernel';
import { Button } from '@/ui-kit/components';
import { fixed, formatArea } from '@/ui-kit/format';
import { usePalette } from '@/ui-kit/theme';

import type { DistrictCoverageView } from '../contract';
import {
  DISTRICT_FILL,
  DISTRICT_FIT_PADDING,
  DISTRICT_MAP_HEIGHT,
  DISTRICT_SWATCH,
  type DistrictsViewProps,
} from './districts-view.constants';
import { useDistricts, useTurfViewport } from './hooks';
import { TurfLayers } from './layers';
import { useCityName } from './use-city-names';

/**
 * The Home City split into its districts (Districts modal from the Turf tab): a dark map with the
 * district boundaries and the Turfer's turf, and below it every district with the turf held there.
 * Tapping a row or a district on the map selects it and fits the camera to it; tapping it again
 * goes back to the whole city.
 */
export function DistrictsView({ onPickCity }: DistrictsViewProps) {
  const p = usePalette();
  const t = useT('turf');
  const tc = useT('common');
  const cityName = useCityName();
  const view = useDistricts();
  const [selected, setSelected] = useState<string | null>(null);
  const list = useRef<FlatList<DistrictCoverageView>>(null);

  if (view === null) {
    return (
      <View style={[s.center, { backgroundColor: p.bg }]} testID='districts-failed'>
        <Text style={[s.message, { color: p.text }]}>{t('districts.loadFailed')}</Text>
      </View>
    );
  }
  if (view === undefined) {
    return (
      <View style={[s.center, { backgroundColor: p.bg }]}>
        <ActivityIndicator color={ACCENT} accessibilityLabel={tc('loading')} />
      </View>
    );
  }
  if (view.status === 'no-city') {
    return (
      <View style={[s.center, { backgroundColor: p.bg }]} testID='districts-no-city'>
        <Text style={[s.message, { color: p.text }]}>{t('districts.noCity')}</Text>
        <Button testID='districts-choose-city' label={t('chooseCity')} onPress={onPickCity} />
      </View>
    );
  }
  const name = cityName(view.city);
  const districts = view.status === 'ready' ? view.districts : [];
  const bounds = view.status === 'ready' ? view.bounds : view.city.bounds;
  const toggle = (id: string) => setSelected((cur) => (cur === id ? null : id));
  // A district tapped on the map: select it and bring its row into view.
  const selectFromMap = (id: string) => {
    toggle(id);
    const index = districts.findIndex((d) => d.id === id);
    if (index >= 0 && id !== selected) {
      list.current?.scrollToIndex({ index, viewPosition: 0.5 });
    }
  };
  const withTurf = districts.filter((d) => d.cellCount > 0).length;

  return (
    <View style={[s.root, { backgroundColor: p.bg }]} testID='districts'>
      <DistrictsMap
        cityName={name}
        bounds={bounds}
        districts={districts}
        selected={selected}
        onSelect={selectFromMap}
      />
      {view.status === 'no-data' ? (
        <View style={s.center} testID='districts-no-data'>
          <Text style={[s.message, { color: p.text }]}>{t('districts.noData', { city: name })}</Text>
        </View>
      ) : (
        <FlatList
          ref={list}
          testID='districts-list'
          onScrollToIndexFailed={({ averageItemLength, index }) =>
            list.current?.scrollToOffset({ offset: averageItemLength * index })
          }
          data={districts}
          keyExtractor={(d) => d.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <View style={s.header}>
              <Text style={[s.city, { color: p.text }]} accessibilityRole='header'>
                {name}
              </Text>
              <Text style={[s.summary, { color: p.muted }]} testID='districts-summary'>
                {t('districts.summary', {
                  area: formatArea(view.coveredKm2),
                  withTurf: fixed(withTurf, 0),
                  total: fixed(districts.length, 0),
                })}
              </Text>
              {view.coveredKm2 === 0 && (
                <Text style={[s.hint, { color: p.text }]}>{t('districts.noTurf', { city: name })}</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <DistrictRow district={item} selected={item.id === selected} onPress={() => toggle(item.id)} />
          )}
          ListFooterComponent={<Text style={[s.credit, { color: p.muted }]}>{t('districts.credit')}</Text>}
        />
      )}
    </View>
  );
}

function DistrictRow({
  district: d,
  selected,
  onPress,
}: {
  district: DistrictCoverageView;
  selected: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  const t = useT('turf');
  const covered = formatArea(d.coveredKm2);
  const area = formatArea(d.areaKm2);
  return (
    <Pressable
      testID={`district-${d.id}`}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={t('districts.rowLabel', { name: d.name, covered, area })}
      accessibilityHint={t('districts.selectHint')}
      accessibilityState={{ selected }}
      style={[
        s.row,
        { backgroundColor: p.card, borderColor: selected ? ACCENT : p.border, borderWidth: selected ? 2 : 1 },
      ]}
    >
      <View
        style={[
          s.swatch,
          d.cellCount > 0
            ? {
                backgroundColor: TIER_COLOR.glowing,
                opacity: Math.min(1, DISTRICT_SWATCH.floor + d.share * DISTRICT_SWATCH.perShare),
              }
            : { borderWidth: 1, borderColor: p.border },
        ]}
      />
      <Text style={[s.name, { color: p.text }]} numberOfLines={2}>
        {d.name}
      </Text>
      <View style={s.figures}>
        <Text style={[s.covered, { color: p.text }]} testID={`district-${d.id}-covered`}>
          {covered}
        </Text>
        <Text style={[s.area, { color: p.muted }]}>{t('districts.rowArea', { area })}</Text>
      </View>
    </Pressable>
  );
}

/** The district's fill opacity on the map and in the row's swatch. */
function fillOpacity(share: number): number {
  return Math.min(DISTRICT_FILL.max, DISTRICT_FILL.floor + share * DISTRICT_FILL.perShare);
}

function DistrictsMap({
  cityName,
  bounds,
  districts,
  selected,
  onSelect,
}: {
  cityName: string;
  bounds: BoundingBox;
  districts: DistrictCoverageView[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT('turf');
  const camera = useRef<CameraRef>(null);
  const [viewport, setViewport] = useState<{ bbox: BoundingBox; zoom: number } | null>(null);
  const cells = useTurfViewport(viewport);

  const shapes = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: districts.map((d) => ({
        type: 'Feature',
        id: d.id,
        properties: { id: d.id, opacity: fillOpacity(d.share) },
        geometry: { type: 'MultiPolygon', coordinates: d.polygons },
      })),
    }),
    [districts]
  );

  const fit = useCallback((box: BoundingBox) => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) =>
      camera.current?.fitBounds([...box] as [number, number, number, number], {
        padding: DISTRICT_FIT_PADDING,
        duration: reduce ? 0 : 500,
      })
    );
  }, []);

  // Follow the selection: the selected district, or the whole city. The first view is the camera's
  // initial one.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const d = districts.find((x) => x.id === selected);
    fit(d ? d.bounds : bounds);
    // Only a new selection moves the camera, not a re-read of the turf numbers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const isSelected = ['==', ['get', 'id'], selected ?? ''] as never;
  return (
    <View
      style={{ height: DISTRICT_MAP_HEIGHT }}
      accessible
      accessibilityLabel={t('districts.mapLabel', { city: cityName })}
      testID='districts-map'
    >
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_DARK}
        logo={false}
        compass={false}
        attributionPosition={{ bottom: 6, right: 6 }}
        onRegionDidChange={(e) => setViewport({ bbox: e.nativeEvent.bounds, zoom: e.nativeEvent.zoom })}
      >
        <Camera
          ref={camera}
          initialViewState={{ bounds: [...bounds] as [number, number, number, number], padding: DISTRICT_FIT_PADDING }}
        />
        <GeoJSONSource
          id='districts'
          data={shapes}
          // No extra touch margin: districts are small at city zoom, and a finger near a border must
          // pick the district under it, not its neighbour.
          hitbox={{ top: 0, right: 0, bottom: 0, left: 0 }}
          onPress={(e) => {
            const id = e.nativeEvent.features[0]?.properties?.id;
            if (typeof id === 'string') {
              onSelect(id);
            }
          }}
        >
          <Layer
            id='districts-fill'
            type='fill'
            paint={{
              'fill-color': TIER_COLOR.glowing,
              'fill-opacity': ['case', isSelected, DISTRICT_FILL.selected, ['get', 'opacity']] as never,
            }}
          />
        </GeoJSONSource>
        <TurfLayers cells={cells} />
        <GeoJSONSource id='districts-outline' data={shapes}>
          <Layer
            id='districts-line'
            type='line'
            layout={{ 'line-join': 'round' }}
            paint={{
              'line-color': ['case', isSelected, ACCENT, DARK.borderControl] as never,
              'line-width': ['case', isSelected, 3, 1.2] as never,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md, padding: SPACE.lg },
  message: { fontSize: FONT_SIZE.body, textAlign: 'center' },
  list: { padding: SPACE.md, gap: SPACE.sm },
  header: { gap: 2, marginBottom: SPACE.sm },
  city: { fontFamily: FONT_FAMILY.display, fontSize: 24, textTransform: 'uppercase' },
  summary: { fontSize: FONT_SIZE.caption },
  hint: { fontSize: FONT_SIZE.caption, marginTop: SPACE.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.card,
    minHeight: 52,
  },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  name: { flex: 1, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  figures: { alignItems: 'flex-end' },
  covered: { fontFamily: FONT_FAMILY.numeric, fontSize: FONT_SIZE.body, fontVariant: ['tabular-nums'] },
  area: { fontSize: FONT_SIZE.caption },
  credit: { fontSize: FONT_SIZE.caption, marginTop: SPACE.md, textAlign: 'center' },
});
