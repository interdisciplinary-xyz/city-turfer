import { Camera, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACTIVITY_TYPES, type ActivityType } from '@/shared-kernel';
import { Button, Stat } from '@/ui-kit/components';
import { formatDistance, formatDuration, formatPaceOrSpeed, formatSpeedNow } from '@/ui-kit/format';
import {
  ACCENT,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  TYPE_COLOR,
  TYPE_GLYPH,
  TYPE_LABEL,
  usePalette,
} from '@/ui-kit/theme';
import { trackWithGaps } from '@/ui-kit/trackGeometry';

import { useRecording } from './useRecording';

const STATUS_BANNER: Record<string, { text: string; color: string }> = {
  acquiring: { text: 'Waiting for GPS…', color: '#5C6577' },
  paused: { text: 'Paused', color: '#FFB02E' },
  autoPaused: { text: 'Auto-paused — start moving to resume', color: '#7B2FF7' },
};

export function RecordView({ onFinished }: { onFinished: (activityId: string) => void }) {
  const p = usePalette();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { snapshot, track, activeS, prepare, start, pause, resume, finish, discard } = useRecording();
  const [type, setType] = useState<ActivityType>('walk');
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(true);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    void prepare();
  }, [prepare]);

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
      if (r.kind === 'location-services-off') Alert.alert('Location is off', 'Turn on Location Services to record.');
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
      if (r.kind === 'finished') onFinished(r.sessionId);
      else if (r.kind === 'too-short') {
        Alert.alert('Too short to save', 'Move a little further, or discard this recording.', [
          { text: 'Keep recording', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => void discard() },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  const status = !snapshot
    ? null
    : snapshot.gps === 'acquiring' && snapshot.status === 'recording'
      ? 'acquiring'
      : snapshot.status;
  const banner = status ? STATUS_BANNER[status] : undefined;
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
      >
        <Camera
          initialViewState={{ zoom: 16 }}
          trackUserLocation={following ? 'default' : undefined}
          // MapLibre drops tracking when the user pans; mirror that in our state.
          onTrackUserLocationChange={(e) => e.nativeEvent.trackUserLocation == null && setFollowing(false)}
        />
        <UserLocation accuracy heading />
        <GeoJSONSource id='live-track' data={lines}>
          <Layer
            id='live-track-gap'
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
      </Map>

      {!following && (
        <Pressable
          testID='recenter'
          accessibilityLabel='Recenter on my location'
          onPress={() => setFollowing(true)}
          style={[s.recenter, { top: insets.top + 12, backgroundColor: p.card }]}
        >
          <Text style={{ color: p.text, fontWeight: '700' }}>◎ Recenter</Text>
        </Pressable>
      )}

      <View style={[s.panel, { backgroundColor: p.card, paddingBottom: 40 }]}>
        {banner && (
          <View style={[s.banner, { backgroundColor: banner.color }]}>
            <Text style={s.bannerText}>{banner.text}</Text>
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
                accessibilityLabel='Hold to finish'
                onPressIn={() => {
                  setHolding(true);
                  holdTimer.current = setTimeout(() => {
                    setHolding(false);
                    void doFinish();
                  }, 900);
                }}
                onPressOut={() => {
                  setHolding(false);
                  if (holdTimer.current) clearTimeout(holdTimer.current);
                }}
                style={[s.stop, { backgroundColor: holding ? '#B3261E' : p.danger }]}
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
                  <Text style={s.typeGlyph}>{TYPE_GLYPH[t]}</Text>
                  <Text style={{ color: p.text, fontWeight: '700' }}>{TYPE_LABEL[t]}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              testID='record-start'
              label={`Start ${TYPE_LABEL[type].toLowerCase()}`}
              color={TYPE_COLOR[type]}
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
    padding: 16,
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
  stop: { flex: 1, minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stopText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  banner: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'center' },
  bannerText: { color: '#fff', fontWeight: '700' },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 2, gap: 4 },
  typeGlyph: { fontSize: 26 },
  hint: { textAlign: 'center', fontSize: 13 },
  recenter: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});

export { ACCENT };
