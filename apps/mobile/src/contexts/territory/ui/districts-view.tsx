import { DISPLAY_CASE, DISPLAY_TRACKING, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, type PressEvent } from '@maplibre/maplibre-react-native';
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  type LayoutChangeEvent,
  Linking,
  type ListRenderItem,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACCENT, DARK, FONT_FAMILY, TIER_COLOR } from '@/constants/colors';
import { MAP_STYLE_DARK } from '@/constants/map';
import { useT } from '@/i18n';
import type { BoundingBox } from '@/shared-kernel';
import { Button } from '@/ui-kit/components';
import { fixed, formatArea } from '@/ui-kit/format';
import { usePalette } from '@/ui-kit/theme';

import type { DistrictCoverageView } from '../contract';
import { districtAt } from './district-at';
import { shareBarWidth, shareText } from './district-share';
import { districtItemLayout, districtRowHeight, districtSelectionReducer } from './districts-selection';
import { NO_DISTRICT_SELECTED } from './districts-selection.constants';
import {
  CREDIT_HIT_SLOP,
  DISTRICT_BAR,
  DISTRICT_FILL,
  DISTRICT_FIT_MS,
  DISTRICT_FIT_PADDING,
  DISTRICT_HEADER_GAP,
  DISTRICT_LAYER,
  DISTRICT_LINE,
  DISTRICT_LINE_LAYOUT,
  DISTRICT_MAP_HEIGHT,
  DISTRICT_ROW,
  DISTRICT_SELECTED_FILL,
  DISTRICT_SWATCH,
  type DistrictRowProps,
  type DistrictsViewProps,
  NO_DISTRICTS,
  OSM_COPYRIGHT_URL,
} from './districts-view.constants';
import { useDistricts, useTurfViewport } from './hooks';
import { TurfLayers } from './layers';
import { spokenArea } from './spoken-area';
import { useCityName } from './use-city-names';

const keyOf = (d: DistrictCoverageView) => d.id;

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
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [{ selected, scrollTo }, dispatch] = useReducer(districtSelectionReducer, NO_DISTRICT_SELECTED);
  const list = useRef<FlatList<DistrictCoverageView>>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  const districts = view?.status === 'ready' ? view.districts : NO_DISTRICTS;
  // Fixed rows (two lines of the name at the current text size), so `scrollToIndex` reaches any row.
  const rowHeight = districtRowHeight(fontScale);
  const getItemLayout = useCallback(
    (_: unknown, index: number) => districtItemLayout(index, rowHeight, headerHeight),
    [rowHeight, headerHeight]
  );

  const toggle = useCallback((id: string) => dispatch({ type: 'toggle-row', id }), []);
  // A district tapped on the map: select it and bring its row into view.
  const selectFromMap = useCallback((id: string) => dispatch({ type: 'tap-map', id, districts }), [districts]);
  useEffect(() => {
    if (scrollTo) {
      void AccessibilityInfo.isReduceMotionEnabled().then((reduce) =>
        list.current?.scrollToIndex({ index: scrollTo.index, viewPosition: 0.5, animated: !reduce })
      );
    }
  }, [scrollTo]);
  const renderItem = useCallback<ListRenderItem<DistrictCoverageView>>(
    ({ item }) => <DistrictRow district={item} selected={item.id === selected} onToggle={toggle} height={rowHeight} />,
    [selected, toggle, rowHeight]
  );
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height), []);

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
  const bounds = view.status === 'ready' ? view.bounds : view.city.bounds;
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
      {districts.length > 0 && (
        // Right under the map, as OpenStreetMap asks: the boundaries are OSM data (ODbL).
        <Pressable
          testID='districts-credit'
          onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
          accessibilityRole='link'
          accessibilityHint={t('districts.creditHint')}
          hitSlop={CREDIT_HIT_SLOP}
          style={[s.credit, { borderBottomColor: p.border }]}
        >
          <Text style={[s.creditText, { color: p.muted }]}>{t('districts.credit')}</Text>
        </Pressable>
      )}
      {view.status === 'no-data' ? (
        <View style={s.center} testID='districts-no-data'>
          <Text style={[s.message, { color: p.text }]}>{t('districts.noData', { city: name })}</Text>
        </View>
      ) : (
        <FlatList
          ref={list}
          testID='districts-list'
          data={districts}
          keyExtractor={keyOf}
          getItemLayout={getItemLayout}
          extraData={selected}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + SPACE.md }]}
          ListHeaderComponent={
            <View style={s.header} onLayout={onHeaderLayout}>
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
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const DistrictRow = memo(function DistrictRow({ district: d, selected, onToggle, height }: DistrictRowProps) {
  const p = usePalette();
  const t = useT('turf');
  const covered = spokenArea(d.coveredKm2);
  const area = spokenArea(d.areaKm2);
  const share = shareText(d.cellCount > 0 ? d.share : 0);
  return (
    <Pressable
      testID={`district-${d.id}`}
      onPress={() => onToggle(d.id)}
      accessibilityRole='button'
      accessibilityLabel={t('districts.rowLabel', {
        name: d.name,
        coveredUnit: covered.unit,
        coveredCount: covered.count,
        covered: covered.text,
        areaUnit: area.unit,
        areaCount: area.count,
        area: area.text,
        share,
      })}
      accessibilityHint={t('districts.selectHint')}
      accessibilityState={{ selected }}
      style={[s.row, { height, backgroundColor: p.card, borderColor: selected ? ACCENT : p.border }]}
    >
      <View style={s.line}>
        <View
          style={[
            s.swatch,
            d.cellCount > 0
              ? {
                  backgroundColor: TIER_COLOR.glowing,
                  opacity: Math.min(1, DISTRICT_SWATCH.floor + d.share * DISTRICT_SWATCH.perShare),
                }
              : { borderWidth: 1, borderColor: p.borderControl },
          ]}
        />
        <Text style={[s.name, { color: p.text }]} numberOfLines={2}>
          {d.name}
        </Text>
        <View style={s.figures}>
          <Text style={[s.covered, { color: p.text }]} testID={`district-${d.id}-covered`}>
            {formatArea(d.coveredKm2)}
          </Text>
          <Text style={[s.area, { color: p.muted }]}>{t('districts.rowArea', { area: formatArea(d.areaKm2) })}</Text>
        </View>
      </View>
      <View style={s.progress} testID={`district-${d.id}-progress`}>
        <View style={[s.track, { backgroundColor: p.border }]}>
          <View style={[s.fill, { width: shareBarWidth(d.cellCount > 0 ? d.share : 0, DISTRICT_BAR.minPct) }]} />
        </View>
        <Text style={[s.percent, { color: p.muted }]} testID={`district-${d.id}-share`}>
          {share}
        </Text>
      </View>
    </Pressable>
  );
});

/** The district's fill opacity on the map: none without turf, else from a floor rising with its share. */
function fillOpacity(d: DistrictCoverageView): number {
  return d.cellCount === 0 ? 0 : Math.min(DISTRICT_FILL.max, DISTRICT_FILL.floor + d.share * DISTRICT_FILL.perShare);
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

  const fit = useCallback((box: BoundingBox) => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) =>
      camera.current?.fitBounds([...box] as [number, number, number, number], {
        padding: DISTRICT_FIT_PADDING,
        duration: reduce ? 0 : DISTRICT_FIT_MS,
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

  // The district under the finger, by its boundary (not the map's touch box, which on iOS also
  // takes in the neighbour across a border). A tap outside every district does nothing.
  const latest = useRef(districts);
  latest.current = districts;
  const onPress = useCallback(
    (e: NativeSyntheticEvent<PressEvent>) => {
      const [lon, lat] = e.nativeEvent.lngLat;
      const id = districtAt(latest.current, lon, lat);
      if (id) {
        onSelect(id);
      }
    },
    [onSelect]
  );

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
        onPress={onPress}
        onRegionDidChange={(e) => setViewport({ bbox: e.nativeEvent.bounds, zoom: e.nativeEvent.zoom })}
      >
        <Camera
          ref={camera}
          initialViewState={{ bounds: [...bounds] as [number, number, number, number], padding: DISTRICT_FIT_PADDING }}
        />
        {/* Mounted before the turf, which goes under the outline (`beforeId`): fills, turf, outline. */}
        <DistrictLayers districts={districts} selected={selected} />
        <TurfLayers cells={cells} beforeId={DISTRICT_LAYER.line} />
      </Map>
    </View>
  );
}

/**
 * The district fills and outlines from one source. Memoised: a GeoJSON source re-serialises its
 * data whenever it re-renders, and the map re-renders on every pan (the turf viewport).
 */
const DistrictLayers = memo(function DistrictLayers({
  districts,
  selected,
}: {
  districts: DistrictCoverageView[];
  selected: string | null;
}) {
  const shapes = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: districts.map((d) => ({
        type: 'Feature',
        id: d.id,
        properties: { id: d.id, opacity: fillOpacity(d) },
        geometry: { type: 'MultiPolygon', coordinates: d.polygons },
      })),
    }),
    [districts]
  );
  const style = useMemo(() => {
    const isSelected = ['==', ['get', 'id'], selected ?? ''] as never;
    return {
      fill: { 'fill-color': TIER_COLOR.glowing, 'fill-opacity': ['get', 'opacity'] as never },
      selected: { 'fill-color': DARK.text, 'fill-opacity': DISTRICT_SELECTED_FILL },
      selectedFilter: isSelected,
      line: {
        'line-color': ['case', isSelected, ACCENT, DARK.borderControl] as never,
        'line-width': ['case', isSelected, DISTRICT_LINE.selectedWidth, DISTRICT_LINE.width] as never,
      },
    };
  }, [selected]);

  return (
    <GeoJSONSource id={DISTRICT_LAYER.source} data={shapes}>
      <Layer id={DISTRICT_LAYER.fill} type='fill' paint={style.fill} />
      <Layer id={DISTRICT_LAYER.selected} type='fill' filter={style.selectedFilter} paint={style.selected} />
      <Layer id={DISTRICT_LAYER.line} type='line' layout={DISTRICT_LINE_LAYOUT} paint={style.line} />
    </GeoJSONSource>
  );
});

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md, padding: SPACE.lg },
  message: { fontSize: FONT_SIZE.body, textAlign: 'center' },
  credit: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  creditText: { fontSize: FONT_SIZE.label, textDecorationLine: 'underline' },
  list: { paddingTop: SPACE.md, paddingHorizontal: SPACE.md },
  // Padding, not margin: the header's measured height is the list's offset to the first row.
  header: { gap: DISTRICT_HEADER_GAP, paddingBottom: SPACE.sm },
  city: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.stat,
    textTransform: DISPLAY_CASE,
    letterSpacing: DISPLAY_TRACKING,
  },
  summary: { fontSize: FONT_SIZE.caption },
  hint: { fontSize: FONT_SIZE.caption, marginTop: SPACE.xs },
  row: {
    justifyContent: 'center',
    gap: DISTRICT_ROW.progressGap,
    paddingHorizontal: SPACE.md,
    paddingVertical: DISTRICT_ROW.paddingVertical,
    marginBottom: DISTRICT_ROW.gap,
    borderRadius: RADIUS.card,
    borderWidth: DISTRICT_ROW.border,
    overflow: 'hidden',
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  progress: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: DISTRICT_ROW.progressLine },
  track: { flex: 1, height: DISTRICT_BAR.height, borderRadius: DISTRICT_BAR.radius, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: DISTRICT_BAR.radius, backgroundColor: TIER_COLOR.glowing },
  percent: {
    minWidth: DISTRICT_BAR.percentWidth,
    textAlign: 'right',
    fontFamily: FONT_FAMILY.numeric,
    fontSize: FONT_SIZE.label,
    lineHeight: DISTRICT_ROW.progressLine,
    fontVariant: ['tabular-nums'],
  },
  swatch: { width: DISTRICT_SWATCH.size, height: DISTRICT_SWATCH.size, borderRadius: DISTRICT_SWATCH.radius },
  name: { flex: 1, fontSize: FONT_SIZE.body, lineHeight: DISTRICT_ROW.nameLine, fontWeight: FONT_WEIGHT.bold },
  figures: { alignItems: 'flex-end' },
  covered: { fontFamily: FONT_FAMILY.numeric, fontSize: FONT_SIZE.body, fontVariant: ['tabular-nums'] },
  area: { fontSize: FONT_SIZE.caption },
});
