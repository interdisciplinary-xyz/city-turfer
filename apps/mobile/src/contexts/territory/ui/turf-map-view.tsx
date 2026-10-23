import { FONT_SIZE, LABEL_TRACKING, RADIUS } from '@cityturfer/brand';
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACTIVITY_TYPES } from '@/constants/activity';
import { DARK, FONT_FAMILY, TIER_COLOR, TYPE_COLOR } from '@/constants/colors';
import { MAP_STYLE_DARK } from '@/constants/map';
import { useT } from '@/i18n';
import { type ActivityType, type BoundingBox } from '@/shared-kernel';
import { fixed, formatArea } from '@/ui-kit/format';
import { ActivitySymbol, AppSymbol } from '@/ui-kit/symbol';

import { useTurfSummary, useTurfViewport } from './hooks';
import { TurfLayers } from './layers';
import { FIT_PADDING, type TrackLine, type TurfMapViewProps } from './turf-map-view.constants';
import { useCityName } from './use-city-names';

export type { TrackLine };

/**
 * The main feature: all tracks overlapping + glowing, permanent turf. Always dark.
 * Camera: opens on the Home City when there is one (and flies to a newly chosen one when the map is
 * next on screen); without one it fits all tracks, or follows the Turfer when there are none yet.
 * The screen mounts this only once the Home City has loaded: on iOS MapLibre applies a Camera's
 * initial view and follow mode only if the Camera exists at the map's first layout.
 */
export function TurfMapView({ tracks, homeCity, focused, onPickCity }: TurfMapViewProps) {
  const t = useT('turf');
  const tc = useT('common');
  const cityName = useCityName();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);
  const [view, setView] = useState<{ bbox: BoundingBox; zoom: number } | null>(null);
  const [types, setTypes] = useState<ActivityType[]>([...ACTIVITY_TYPES]);
  const cells = useTurfViewport(view, types);
  const summary = useTurfSummary();
  const fitted = useRef(false);

  const lines = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: tracks
        .filter((t) => t.coordinates.length > 1)
        .map((t) => ({
          type: 'Feature',
          properties: { type: t.type },
          geometry: { type: 'LineString', coordinates: t.coordinates },
        })),
    }),
    [tracks]
  );

  const allBounds = useMemo<BoundingBox | null>(() => {
    let w = Infinity,
      s = Infinity,
      e = -Infinity,
      n = -Infinity;
    for (const t of tracks) {
      for (const [lon, lat] of t.coordinates) {
        w = Math.min(w, lon);
        e = Math.max(e, lon);
        s = Math.min(s, lat);
        n = Math.max(n, lat);
      }
    }
    return Number.isFinite(w) ? [w, s, e, n] : null;
  }, [tracks]);

  const fitAll = useCallback(() => {
    if (allBounds) {
      void AccessibilityInfo.isReduceMotionEnabled().then((reduce) =>
        camera.current?.fitBounds([...allBounds] as [number, number, number, number], {
          padding: FIT_PADDING,
          duration: reduce ? 0 : 600,
        })
      );
    }
  }, [allBounds]);

  const fitCity = useCallback(() => {
    if (homeCity) {
      void AccessibilityInfo.isReduceMotionEnabled().then((reduce) =>
        camera.current?.fitBounds(homeCity.bounds, { padding: FIT_PADDING, duration: reduce ? 0 : 600 })
      );
    }
  }, [homeCity]);

  // No Home City: fit all tracks once they load (the Home City, when set, is the opening view).
  useEffect(() => {
    if (!fitted.current && allBounds && homeCity === null) {
      fitted.current = true;
      setTimeout(fitAll, 300);
    }
  }, [allBounds, fitAll, homeCity]);

  // A Home City chosen (or changed) after the map opened: fly there once the map is on screen.
  const shownCity = useRef<string | null>(homeCity?.id ?? null);
  useEffect(() => {
    const id = homeCity?.id ?? null;
    if (!focused || id === shownCity.current) {
      return;
    }
    shownCity.current = id;
    if (id !== null) {
      fitted.current = true;
      fitCity();
    }
  }, [homeCity, focused, fitCity]);

  const toggle = (type: ActivityType) =>
    setTypes((cur) => (cur.includes(type) ? (cur.length > 1 ? cur.filter((x) => x !== type) : cur) : [...cur, type]));

  return (
    <View style={s.root}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_DARK}
        logo={false}
        compass={false}
        attributionPosition={{ bottom: 8, right: 8 }}
        onRegionDidChange={(e) => setView({ bbox: e.nativeEvent.bounds, zoom: e.nativeEvent.zoom })}
      >
        <Camera
          ref={camera}
          initialViewState={homeCity ? { bounds: homeCity.bounds, padding: FIT_PADDING } : { zoom: 13 }}
          trackUserLocation={homeCity || allBounds ? undefined : 'default'}
        />
        <UserLocation />
        <TurfLayers cells={cells} />
        <GeoJSONSource id='turf-tracks' data={lines}>
          <Layer
            id='turf-tracks-line'
            type='line'
            filter={['in', ['get', 'type'], ['literal', types]] as never}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': [
                'match',
                ['get', 'type'],
                'walk',
                TYPE_COLOR.walk,
                'run',
                TYPE_COLOR.run,
                TYPE_COLOR.cycle,
              ] as never,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 16, 3],
              'line-opacity': 0.35,
              'line-blur': 0.8,
            }}
          />
        </GeoJSONSource>
      </Map>

      <View style={[s.card, { top: insets.top + 10 }]} testID='turf-summary'>
        <Text style={s.title}>{t('title')}</Text>
        <Text style={s.area} testID='turf-summary-area'>
          {summary ? formatArea(summary.areaKm2) : '—'}
        </Text>
        <Text style={s.sub}>
          {summary
            ? t('summary', {
                // Counts as plain digits (no grouping), like the area: Maestro and the Turfer read them as numbers.
                cellCount: summary.cellCount,
                cells: fixed(summary.cellCount, 0),
                strongCount: summary.strongCells,
                strong: fixed(summary.strongCells, 0),
                area: formatArea(summary.newThisWeekKm2),
              })
            : tc('loading')}
        </Text>
        <View style={s.chips}>
          {ACTIVITY_TYPES.map((kind) => {
            const on = types.includes(kind);
            return (
              <Pressable
                key={kind}
                testID={`turf-filter-${kind}`}
                accessibilityRole='checkbox'
                accessibilityLabel={t('filterLabel', { type: kind })}
                accessibilityState={{ checked: on }}
                onPress={() => toggle(kind)}
                style={[
                  s.chip,
                  {
                    borderColor: on ? TYPE_COLOR[kind] : DARK.border,
                    backgroundColor: on ? TYPE_COLOR[kind] + '33' : 'transparent',
                  },
                ]}
              >
                <ActivitySymbol type={kind} size={FONT_SIZE.caption} color={DARK.text} />
                <Text style={s.chipText}>{tc(`activityType.${kind}`)}</Text>
              </Pressable>
            );
          })}
          {homeCity ? (
            <Pressable
              testID='turf-city'
              onPress={fitCity}
              onLongPress={onPickCity}
              accessibilityRole='button'
              accessibilityLabel={t('showCity', { city: cityName(homeCity) })}
              accessibilityHint={t('cityHint')}
              accessibilityActions={onPickCity ? [{ name: 'longpress', label: t('chooseAnotherCity') }] : undefined}
              onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onPickCity?.()}
              style={[s.chip, { borderColor: DARK.border }]}
            >
              <AppSymbol name='house' fallback='⌂' size={FONT_SIZE.caption} color={DARK.text} />
              <Text style={s.chipText}>{cityName(homeCity)}</Text>
            </Pressable>
          ) : onPickCity ? (
            <Pressable
              testID='turf-pick-city'
              onPress={onPickCity}
              accessibilityRole='button'
              accessibilityLabel={t('chooseCity')}
              style={[s.chip, { borderColor: DARK.border }]}
            >
              <AppSymbol name='house' fallback='⌂' size={FONT_SIZE.caption} color={DARK.text} />
              <Text style={s.chipText}>{t('yourCity')}</Text>
            </Pressable>
          ) : null}
          {allBounds && (
            <Pressable
              testID='turf-filter-all'
              onPress={fitAll}
              accessibilityRole='button'
              accessibilityLabel={t('showAllLabel')}
              style={[s.chip, { borderColor: DARK.border }]}
            >
              <AppSymbol
                name='arrow.up.left.and.arrow.down.right'
                fallback='⤢'
                size={FONT_SIZE.caption}
                color={DARK.text}
              />
              <Text style={s.chipText}>{t('showAll')}</Text>
            </Pressable>
          )}
        </View>
        {summary && summary.cellCount === 0 && <Text style={s.empty}>{t('empty')}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK.bg },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    // Night-raised at 92% (EB): the map shows faintly through.
    backgroundColor: `${DARK.card}EB`,
    borderRadius: RADIUS.card,
    padding: 14,
    gap: 4,
  },
  title: {
    color: DARK.muted,
    fontSize: FONT_SIZE.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: LABEL_TRACKING,
  },
  area: { color: TIER_COLOR.blazing, fontSize: 30, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] },
  sub: { color: DARK.muted, fontSize: FONT_SIZE.caption },
  chips: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    borderWidth: 1.5,
  },
  chipText: { color: DARK.text, fontWeight: '700', fontSize: FONT_SIZE.caption },
  empty: { color: DARK.text, marginTop: 8, fontSize: FONT_SIZE.caption },
});
