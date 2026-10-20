import { RADIUS, SPACE } from '@cityturfer/brand';
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACTIVITY_TYPES, TYPE_LABEL } from '@/constants/activity';
import { ON_ACCENT, ON_TIER, ON_TYPE_COLOR, TIER_COLOR, TYPE_COLOR } from '@/constants/colors';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from '@/constants/map';
import { type ActivityType } from '@/shared-kernel';
import { Button, Stat } from '@/ui-kit/components';
import { formatDistance, formatDuration, formatPaceOrSpeed, formatSpeedNow } from '@/ui-kit/format';
import { ActivitySymbol, AppSymbol } from '@/ui-kit/symbol';
import { usePalette } from '@/ui-kit/theme';
import { trackWithGaps } from '@/ui-kit/track-geometry';

import {
  CITY_ZOOM,
  HOLD_MS,
  LIVE_TRACK_BOTTOM_LAYER,
  type RecordViewProps,
  STATUS_BANNER_ROLES,
  STATUS_BANNER_TEXT,
} from './record-view.constants';
import { useRecording } from './use-recording';

/**
 * The map starts on the Home City (`city`) before the first fix, then follows the Turfer. Before a
 * recording starts, a chip at the top shows the city and opens the picker; a newly chosen city is
 * shown on the map (Recenter goes back to the Turfer). With `turf`, a chip at the top right shows
 * or hides the Turfer's turf, before and during a recording. The screen passes the turf as
 * `mapOverlay` (layers placed under `LIVE_TRACK_BOTTOM_LAYER`, empty while hidden).
 */
export function RecordView({
  onFinished,
  city,
  onPickCity,
  focused = true,
  mapOverlay,
  onViewChange,
  turf,
}: RecordViewProps) {
  const p = usePalette();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { snapshot, track, activeS, prepare, start, pause, resume, finish, discard } = useRecording();
  const [type, setType] = useState<ActivityType>('walk');
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(true);
  const [holding, setHolding] = useState(false);
  const camera = useRef<CameraRef>(null);

  useEffect(() => {
    void prepare();
  }, [prepare]);

  // A city chosen from the chip (or elsewhere) while not recording: show it once the tab is on screen.
  const shownCity = useRef<string | null>(city?.id ?? null);
  useEffect(() => {
    const id = city?.id ?? null;
    if (!focused || id === shownCity.current) {
      return;
    }
    shownCity.current = id;
    if (city && !snapshot) {
      // Stop following first, then fly once the Camera has dropped tracking (it would pull back).
      setFollowing(false);
      // Reduce motion: jump instead of flying (brand-system: motion).
      // `alive`: a newer city change cancels this one, also while the setting is being read.
      let alive = true;
      const t = setTimeout(() => {
        void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
          if (!alive) {
            return;
          }
          if (reduce) {
            camera.current?.jumpTo({ center: city.center, zoom: CITY_ZOOM });
          } else {
            camera.current?.flyTo({ center: city.center, zoom: CITY_ZOOM, duration: 800 });
          }
        });
      }, 100);
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }
  }, [city, focused, snapshot]);

  const activeType = snapshot?.type ?? type;
  const color = TYPE_COLOR[activeType];
  const lines = useMemo(() => trackWithGaps(track), [track]);

  const onStart = async () => {
    setBusy(true);
    try {
      const r = await start(type);
      if (r.kind === 'permission-denied') {
        Alert.alert('Location needed', 'Allow location access in Settings so CityTurfer can record your route.');
      }
      if (r.kind === 'location-services-off') {
        Alert.alert('Location is off', 'Turn on Location Services to record.');
      }
      setFollowing(true);
    } catch (e) {
      Alert.alert('Could not start', String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const doFinish = async () => {
    setBusy(true);
    try {
      const r = await finish();
      if (r.kind === 'finished') {
        onFinished(r.sessionId);
      } else if (r.kind === 'too-short') {
        Alert.alert('Too short to save', 'Move a little further, or discard this recording.', [
          { text: 'Keep recording', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => void discard() },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmFinish = () =>
    Alert.alert('Finish recording?', 'Your route will be saved and its streets added to your turf.', [
      { text: 'Keep recording', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: () => void doFinish() },
    ]);

  const status = !snapshot
    ? null
    : snapshot.gps === 'acquiring' && snapshot.status === 'recording'
      ? 'acquiring'
      : snapshot.status;
  const bannerText = status ? STATUS_BANNER_TEXT[status] : undefined;
  const dist = formatDistance(snapshot?.distanceM ?? 0);
  const now = formatSpeedNow(activeType, snapshot?.currentSpeedMps ?? null);
  const avg = formatPaceOrSpeed(activeType, snapshot?.distanceM ?? 0, snapshot?.movingS ?? 0);

  return (
    <View style={[s.root, { backgroundColor: p.bg }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={scheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        logo={false}
        attributionPosition={{ top: insets.top + 8, left: 8 }}
        compass={false}
        // Both: while following the Turfer, settle events can be rare or dropped.
        onRegionIsChanging={(e) => onViewChange?.({ bbox: e.nativeEvent.bounds, zoom: e.nativeEvent.zoom })}
        onRegionDidChange={(e) => onViewChange?.({ bbox: e.nativeEvent.bounds, zoom: e.nativeEvent.zoom })}
      >
        <Camera
          ref={camera}
          initialViewState={city ? { center: city.center, zoom: CITY_ZOOM } : { zoom: 16 }}
          trackUserLocation={following ? 'default' : undefined}
          // MapLibre drops tracking when the user pans; mirror that in our state.
          onTrackUserLocationChange={(e) => e.nativeEvent.trackUserLocation == null && setFollowing(false)}
        />
        <GeoJSONSource id='live-track' data={lines}>
          <Layer
            id={LIVE_TRACK_BOTTOM_LAYER}
            type='line'
            filter={['==', ['get', 'kind'], 'gap'] as never}
            paint={{ 'line-color': color, 'line-width': 3, 'line-opacity': 0.6, 'line-dasharray': [1.5, 2] }}
          />
          <Layer
            id='live-track-glow'
            type='line'
            filter={['==', ['get', 'kind'], 'track'] as never}
            paint={{ 'line-color': color, 'line-width': 12, 'line-opacity': 0.25, 'line-blur': 6 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id='live-track-line'
            type='line'
            filter={['==', ['get', 'kind'], 'track'] as never}
            paint={{ 'line-color': color, 'line-width': 5 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </GeoJSONSource>
        {/* Mounted after the live track so it can sit under it (`beforeId`); always mounted so the
            order holds when it's toggled. Empty while hidden. */}
        {mapOverlay}
        <UserLocation accuracy heading />
      </Map>

      {!snapshot && onPickCity && (
        <Pressable
          testID='record-city'
          accessibilityRole='button'
          accessibilityLabel={city ? `City: ${city.name}` : 'Choose your city'}
          accessibilityHint='Opens the city picker'
          onPress={onPickCity}
          style={[s.city, { top: insets.top + 12, backgroundColor: p.card }]}
        >
          <AppSymbol name='house' fallback='⌂' size={15} color={p.text} />
          <Text style={[s.cityName, { color: p.text }]} numberOfLines={1}>
            {city ? city.name : 'Your city'}
          </Text>
          <AppSymbol name='chevron.down' fallback='▾' size={12} color={p.text} />
        </Pressable>
      )}

      {/* One column at the top right, so the chips never overlap whatever the text size. */}
      <View style={[s.chipColumn, { top: insets.top + 12 }]} pointerEvents='box-none'>
        {turf && (
          <Pressable
            testID='record-turf'
            accessibilityRole='switch'
            accessibilityLabel='Show my turf'
            accessibilityState={{ checked: turf.shown }}
            onPress={turf.onToggle}
            hitSlop={6}
            style={[s.chip, { backgroundColor: turf.shown ? TIER_COLOR.glowing : p.card }]}
          >
            <AppSymbol
              name={turf.shown ? 'hexagon.fill' : 'hexagon'}
              fallback='⬡'
              size={15}
              color={turf.shown ? ON_TIER.glowing : p.text}
            />
            <Text style={{ color: turf.shown ? ON_TIER.glowing : p.text, fontWeight: '700' }}>Turf</Text>
          </Pressable>
        )}
        {!following && (
          <Pressable
            testID='recenter'
            accessibilityRole='button'
            accessibilityLabel='Recenter on my location'
            onPress={() => setFollowing(true)}
            hitSlop={6}
            style={[s.chip, { backgroundColor: p.card }]}
          >
            <AppSymbol name='location' fallback='◎' size={15} color={p.text} />
            <Text style={{ color: p.text, fontWeight: '700' }}>Recenter</Text>
          </Pressable>
        )}
      </View>

      <View style={[s.panel, { backgroundColor: p.card, paddingBottom: 40 }]}>
        {bannerText && (
          <View style={[s.banner, { backgroundColor: p[STATUS_BANNER_ROLES.background] }]}>
            <Text style={[s.bannerText, { color: p[STATUS_BANNER_ROLES.text] }]}>{bannerText}</Text>
          </View>
        )}

        {snapshot ? (
          <>
            <Stat label='Distance' value={dist.value} unit={dist.unit} big testID='stat-distance' />
            <View style={s.row}>
              <Stat label='Time' value={formatDuration(activeS)} testID='stat-time' />
              <Stat label={activeType === 'cycle' ? 'Speed' : 'Pace'} value={now.value} unit={now.unit} />
              <Stat label={activeType === 'cycle' ? 'Avg speed' : 'Avg pace'} value={avg.value} unit={avg.unit} />
            </View>
            <View style={s.row}>
              {snapshot.status === 'paused' ? (
                <Button
                  testID='record-resume'
                  label='Resume'
                  color={color}
                  textColor={ON_TYPE_COLOR[activeType]}
                  onPress={() => void resume()}
                  style={s.flex}
                  busy={busy}
                />
              ) : (
                <Button
                  testID='record-pause'
                  label='Pause'
                  color={p.border}
                  textColor={p.text}
                  onPress={() => void pause()}
                  style={s.flex}
                  busy={busy}
                />
              )}
              <Pressable
                testID='record-stop'
                accessibilityRole='button'
                accessibilityLabel='Finish recording'
                accessibilityHint='Press and hold to finish. With a screen reader, double-tap to choose.'
                accessibilityActions={[{ name: 'activate', label: 'Finish recording' }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === 'activate') {
                    confirmFinish();
                  }
                }}
                delayLongPress={HOLD_MS}
                onPressIn={() => setHolding(true)}
                onPressOut={() => setHolding(false)}
                onLongPress={() => {
                  setHolding(false);
                  void doFinish();
                }}
                style={[s.stop, { backgroundColor: p.danger, opacity: holding ? 0.8 : 1 }]}
              >
                <Text style={s.stopText}>{holding ? 'Keep holding…' : 'Hold to finish'}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={s.row} accessibilityRole='radiogroup'>
              {ACTIVITY_TYPES.map((t) => (
                <Pressable
                  key={t}
                  testID={`activity-type-${t}`}
                  accessibilityRole='radio'
                  accessibilityLabel={TYPE_LABEL[t]}
                  accessibilityState={{ selected: type === t }}
                  onPress={() => setType(t)}
                  style={[
                    s.typeChip,
                    {
                      borderColor: type === t ? TYPE_COLOR[t] : p.border,
                      backgroundColor: type === t ? TYPE_COLOR[t] + '22' : 'transparent',
                    },
                  ]}
                >
                  <ActivitySymbol type={t} size={26} color={p.text} />
                  <Text style={{ color: p.text, fontWeight: '700' }}>{TYPE_LABEL[t]}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              testID='record-start'
              label={`Start ${TYPE_LABEL[type].toLowerCase()}`}
              color={TYPE_COLOR[type]}
              textColor={ON_TYPE_COLOR[type]}
              onPress={onStart}
              busy={busy}
            />
            <Text style={[s.hint, { color: p.muted }]}>Every street you cover becomes your turf.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACE.lg,
    gap: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  stop: { flex: 1, minHeight: 56, borderRadius: RADIUS.control, alignItems: 'center', justifyContent: 'center' },
  stopText: { color: ON_ACCENT, fontWeight: '800', fontSize: 17 },
  banner: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'center' },
  bannerText: { fontWeight: '700' },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.chip, borderWidth: 2, gap: 4 },
  hint: { textAlign: 'center', fontSize: 13 },
  city: {
    position: 'absolute',
    left: 12,
    maxWidth: '55%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.panel,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  chipColumn: { position: 'absolute', right: 12, alignItems: 'flex-end', gap: 12 },
  cityName: { fontWeight: '700', flexShrink: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.panel,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});
