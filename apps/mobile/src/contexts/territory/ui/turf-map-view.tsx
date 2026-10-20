import { Camera, type CameraRef, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACTIVITY_TYPES, TYPE_GLYPH, TYPE_LABEL } from '@/constants/activity';
import { DARK, FONT_FAMILY, TYPE_COLOR } from '@/constants/colors';
import { MAP_STYLE_DARK } from '@/constants/map';
import { type ActivityType, type BoundingBox } from '@/shared-kernel';
import { formatArea } from '@/ui-kit/format';

import { useTurfSummary, useTurfViewport } from './hooks';
import { TurfLayers } from './layers';
import { FIT_PADDING, type TrackLine, type TurfMapViewProps } from './turf-map-view.constants';

export type { TrackLine };

/**
 * The main feature: all tracks overlapping + glowing, permanent turf. Always dark.
 * Camera: opens on the Home City when there is one (and flies to a newly chosen one when the map is
 * next on screen); without one it fits all tracks, or follows the Turfer when there are none yet.
 * The screen mounts this only once the Home City has loaded: on iOS MapLibre applies a Camera's
 * initial view and follow mode only if the Camera exists at the map's first layout.
 */
export function TurfMapView({ tracks, homeCity, focused, onPickCity }: TurfMapViewProps) {
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
      void camera.current?.fitBounds([...allBounds] as [number, number, number, number], {
        padding: FIT_PADDING,
        duration: 600,
      });
    }
  }, [allBounds]);

  const fitCity = useCallback(() => {
    if (homeCity) {
      void camera.current?.fitBounds(homeCity.bounds, { padding: FIT_PADDING, duration: 600 });
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

  const toggle = (t: ActivityType) =>
    setTypes((cur) => (cur.includes(t) ? (cur.length > 1 ? cur.filter((x) => x !== t) : cur) : [...cur, t]));

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
        <Text style={s.title}>Your turf</Text>
        <Text style={s.area} testID='turf-summary-area'>
          {summary ? formatArea(summary.areaKm2) : '—'}
        </Text>
        <Text style={s.sub}>
          {summary
            ? `${summary.cellCount} cells · ${summary.strongCells} strong · +${formatArea(summary.newThisWeekKm2)} this week`
            : 'Loading…'}
        </Text>
        <View style={s.chips}>
          {ACTIVITY_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <Pressable
                key={t}
                testID={`turf-filter-${t}`}
                accessibilityRole='checkbox'
                accessibilityLabel={`${TYPE_LABEL[t]} turf`}
                accessibilityState={{ checked: on }}
                onPress={() => toggle(t)}
                style={[
                  s.chip,
                  {
                    borderColor: on ? TYPE_COLOR[t] : DARK.border,
                    backgroundColor: on ? TYPE_COLOR[t] + '33' : 'transparent',
                  },
                ]}
              >
                <Text style={s.chipText}>
                  {TYPE_GLYPH[t]} {TYPE_LABEL[t]}
                </Text>
              </Pressable>
            );
          })}
          {homeCity ? (
            <Pressable
              testID='turf-city'
              onPress={fitCity}
              onLongPress={onPickCity}
              accessibilityRole='button'
              accessibilityLabel={`Show ${homeCity.name}`}
              accessibilityHint='Long press to choose another city'
              accessibilityActions={onPickCity ? [{ name: 'longpress', label: 'Choose another city' }] : undefined}
              onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onPickCity?.()}
              style={[s.chip, { borderColor: DARK.border }]}
            >
              <Text style={s.chipText}>⌂ {homeCity.name}</Text>
            </Pressable>
          ) : onPickCity ? (
            <Pressable
              testID='turf-pick-city'
              onPress={onPickCity}
              accessibilityRole='button'
              accessibilityLabel='Choose your city'
              style={[s.chip, { borderColor: DARK.border }]}
            >
              <Text style={s.chipText}>⌂ Your city</Text>
            </Pressable>
          ) : null}
          {allBounds && (
            <Pressable
              testID='turf-filter-all'
              onPress={fitAll}
              accessibilityRole='button'
              accessibilityLabel='Show all turf'
              style={[s.chip, { borderColor: DARK.border }]}
            >
              <Text style={s.chipText}>⤢ All</Text>
            </Pressable>
          )}
        </View>
        {summary && summary.cellCount === 0 && (
          <Text style={s.empty}>Record a walk, run or ride — every street you cover becomes yours.</Text>
        )}
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
    backgroundColor: 'rgba(21,25,36,0.92)',
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  title: { color: DARK.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  area: { color: '#FFF3C4', fontSize: 30, fontFamily: FONT_FAMILY.numeric, fontVariant: ['tabular-nums'] },
  sub: { color: DARK.muted, fontSize: 13 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5 },
  chipText: { color: DARK.text, fontWeight: '700', fontSize: 13 },
  empty: { color: DARK.text, marginTop: 8, fontSize: 13 },
});
