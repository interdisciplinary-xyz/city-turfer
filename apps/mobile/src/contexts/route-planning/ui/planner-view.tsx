import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '@cityturfer/brand';
import { Camera, type CameraRef, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACTIVITY_TYPES } from '@/constants/activity';
import { ACCENT, DARK, ON_ACCENT, TYPE_COLOR } from '@/constants/colors';
import { MAP_STYLE_DARK } from '@/constants/map';
import { useT } from '@/i18n';
import type { ActivityType } from '@/shared-kernel';
import { Stat } from '@/ui-kit/components';
import { fixed, formatArea, formatDistance } from '@/ui-kit/format';
import { ActivitySymbol, AppSymbol } from '@/ui-kit/symbol';

import type { PlannedRouteView } from '../contract';
import { MAX_WAYPOINTS } from '../domain/planned-route.constants';
import { usePlannerActions, useRoutingConsent } from './hooks';
import { PlannedRouteLayers } from './planned-route-layer';
import {
  type PendingWaypoint,
  PLAN_FIT_PADDING,
  plannedTime,
  PLANNER_CHIP_HIT_SLOP,
  PLANNER_ZOOM,
  type PlannerErrorKey,
  plannerErrorKey,
  type PlannerViewProps,
  routeBounds,
} from './planner-view.constants';
import { RoutingConsentSheet } from './routing-consent-sheet';

/** Where the camera opens: a restored plan, else the Home City (then the Turfer, once located). */
function initialView(route: PlannedRouteView | null, cityCenter: [number, number] | null) {
  const bounds = routeBounds(route);
  if (route && route.waypoints.length > 1 && bounds) {
    return { bounds: [...bounds] as [number, number, number, number], padding: PLAN_FIT_PADDING };
  }
  const first = route?.waypoints[0];
  if (first) {
    return { center: [first.lon, first.lat] as [number, number], zoom: PLANNER_ZOOM };
  }
  return cityCenter ? { center: cityCenter, zoom: PLANNER_ZOOM } : { zoom: PLANNER_ZOOM };
}

/**
 * The route planner: the dark map with the Turfer's turf under it (`underlay`), so ground not yet
 * theirs shows as gaps. Tap to add Waypoints; a card shows distance, estimated time and the new cells
 * the route would add (an estimate, "≈"). Straight legs (no consent, offline) are dashed and named.
 * The camera opens on a restored plan, else on the Turfer (following until the first tap or pan),
 * else the Home City. The screen mounts this once the plan and Home City have loaded: iOS MapLibre
 * applies a Camera's initial view only if the Camera exists at the map's first layout.
 */
export function PlannerView({ route, cityCenter, underlay, onViewChange }: PlannerViewProps) {
  const t = useT('planner');
  const tc = useT('common');
  const insets = useSafeAreaInsets();
  const actions = usePlannerActions();
  const [consent, setConsent] = useRoutingConsent();
  const camera = useRef<CameraRef>(null);
  const [initial] = useState(() => initialView(route, cityCenter));
  const [following, setFollowing] = useState(() => (route?.waypoints.length ?? 0) === 0);
  const [pending, setPending] = useState<PendingWaypoint[]>([]);
  const [inFlight, setInFlight] = useState(0);
  const [error, setError] = useState<PlannerErrorKey | null>(null);
  const [sheet, setSheet] = useState(false);
  const asked = useRef(false);

  const run = useCallback(
    async (edit: () => Promise<unknown>) => {
      setError(null);
      setInFlight((n) => n + 1);
      try {
        await edit();
      } catch (e) {
        const key = plannerErrorKey(e);
        setError(key);
        AccessibilityInfo.announceForAccessibility(t(key, { max: MAX_WAYPOINTS }));
      } finally {
        setInFlight((n) => n - 1);
      }
    },
    [t]
  );

  const onMapPress = (lon: number, lat: number) => {
    setFollowing(false);
    const p: PendingWaypoint = { lat, lon };
    setPending((cur) => [...cur, p]);
    void run(() => actions.add(p)).finally(() => setPending((cur) => cur.filter((x) => x !== p)));
    if (consent === 'unasked' && !asked.current) {
      asked.current = true;
      setSheet(true);
    }
  };

  const answer = (granted: boolean) => {
    setSheet(false);
    void setConsent(granted).catch(() => setError('errors.generic'));
  };

  const type: ActivityType = route?.type ?? 'walk';
  const count = route?.waypoints.length ?? 0;
  const hasLegs = (route?.legs.length ?? 0) > 0;
  const straight = route?.legs.some((l) => !l.snapped) ?? false;
  const routing = inFlight > 0 && consent === 'granted';
  const shown = route?.showOnRecord ?? false;

  return (
    <View style={s.root}>
      <Map
        testID='planner-map'
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_DARK}
        logo={false}
        compass={false}
        attributionPosition={{ top: 8, right: 8 }}
        onPress={(e) => onMapPress(e.nativeEvent.lngLat[0], e.nativeEvent.lngLat[1])}
        onRegionDidChange={(e) => onViewChange?.({ bbox: e.nativeEvent.bounds, zoom: e.nativeEvent.zoom })}
      >
        <Camera
          ref={camera}
          initialViewState={initial}
          trackUserLocation={following ? 'default' : undefined}
          // MapLibre drops tracking when the Turfer pans; mirror that in our state.
          onTrackUserLocationChange={(e) => e.nativeEvent.trackUserLocation == null && setFollowing(false)}
        />
        <PlannedRouteLayers route={route} pending={pending} />
        {/* Mounted after the route so it can sit under it (`beforeId`). */}
        {underlay}
        <UserLocation />
      </Map>

      <View style={s.types} accessibilityRole='radiogroup' pointerEvents='box-none'>
        {ACTIVITY_TYPES.map((kind) => {
          const on = type === kind;
          return (
            <Pressable
              key={kind}
              testID={`planner-type-${kind}`}
              accessibilityRole='radio'
              accessibilityLabel={t('typeLabel', { type: kind })}
              accessibilityState={{ selected: on, checked: on }}
              hitSlop={PLANNER_CHIP_HIT_SLOP}
              onPress={() => void run(() => actions.setType(kind))}
              style={[
                s.chip,
                {
                  borderColor: on ? TYPE_COLOR[kind] : DARK.border,
                  backgroundColor: on ? TYPE_COLOR[kind] + '33' : DARK.card,
                },
              ]}
            >
              <ActivitySymbol type={kind} size={FONT_SIZE.body} color={DARK.text} />
              <Text style={s.chipText}>{tc(`activityType.${kind}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[s.panel, { paddingBottom: insets.bottom + SPACE.lg }]} testID='planner-panel'>
        {route && hasLegs ? (
          <Stats route={route} />
        ) : (
          <Text testID='planner-hint' style={s.hint}>
            {count === 0 && pending.length === 0 ? t('emptyHint') : t('nextHint')}
          </Text>
        )}

        {routing ? (
          <View style={s.note} testID='planner-routing'>
            <ActivityIndicator color={DARK.text} size='small' />
            <Text style={s.noteText}>{t('routing')}</Text>
          </View>
        ) : (
          straight && (
            <View style={s.note} testID='planner-straight'>
              <View style={s.noteBody}>
                <Text style={s.noteTitle}>{t('straight')}</Text>
                <Text style={s.noteText}>{t('straightHint')}</Text>
              </View>
              {consent === 'granted' ? (
                <LinkButton
                  testID='planner-retry'
                  label={t('retry')}
                  a11yLabel={t('retryLabel')}
                  onPress={() => void run(actions.snap)}
                />
              ) : (
                <LinkButton
                  testID='planner-follow-streets'
                  label={t('followStreets')}
                  a11yLabel={t('followStreetsLabel')}
                  onPress={() => setSheet(true)}
                />
              )}
            </View>
          )
        )}

        {error && (
          <Text testID='planner-error' accessibilityLiveRegion='polite' style={s.error}>
            {t(error, { max: MAX_WAYPOINTS })}
          </Text>
        )}

        <View style={s.row}>
          <SmallButton
            testID='planner-undo'
            label={t('undo')}
            a11yLabel={t('undoLabel')}
            disabled={count === 0}
            onPress={() => void run(actions.undo)}
          />
          <SmallButton
            testID='planner-clear'
            label={t('clear')}
            a11yLabel={t('clearLabel')}
            disabled={count === 0}
            onPress={() => void run(actions.clear)}
          />
          <SmallButton
            testID='planner-close-loop'
            label={t('closeLoop')}
            a11yLabel={t('closeLoopLabel')}
            disabled={count < 2 || (route?.isLoop ?? false)}
            onPress={() => void run(actions.closeLoop)}
          />
        </View>

        <Pressable
          testID='planner-use-on-record'
          accessibilityRole='switch'
          accessibilityLabel={t('useOnRecordLabel')}
          accessibilityState={{ checked: shown, disabled: count < 2 }}
          disabled={count < 2}
          onPress={() => void run(() => actions.showOnRecord(!shown))}
          style={({ pressed }) => [
            s.record,
            shown ? s.recordOn : { backgroundColor: ACCENT, borderColor: ACCENT },
            { opacity: count < 2 ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          {shown && <AppSymbol name='checkmark' fallback='✓' size={FONT_SIZE.body} color={DARK.text} />}
          <Text style={[s.recordText, { color: shown ? DARK.text : ON_ACCENT }]}>
            {shown ? t('shownOnRecord') : t('useOnRecord')}
          </Text>
        </Pressable>

        <Text style={s.attribution}>{t('attribution')}</Text>
      </View>

      <RoutingConsentSheet
        visible={sheet}
        onFollowStreets={() => answer(true)}
        onStraightLines={() => answer(false)}
        onDismiss={() => setSheet(false)}
      />
    </View>
  );
}

/** Distance, estimated time and ≈ new cells, read out as one sentence with the units spelled out. */
function Stats({ route }: { route: PlannedRouteView }) {
  const t = useT('planner');
  const dist = formatDistance(route.distanceM);
  const time = plannedTime(route.durationS);
  const km = Math.round(route.distanceM / 10) / 100;
  return (
    <View style={s.statsBlock}>
      <View
        testID='planner-stats'
        accessible
        accessibilityLabel={t('summaryLabel', {
          km,
          kmText: fixed(km, 2),
          minutes: time.totalMinutes,
          count: route.newCellCount,
        })}
        style={s.row}
      >
        <Stat label={t('stat.distance')} value={dist.value} unit={dist.unit} testID='planner-distance' />
        <Stat
          label={t('stat.time')}
          value={t('time', {
            long: time.hours > 0 ? 'yes' : 'no',
            hours: String(time.hours),
            minutes: time.hours > 0 ? String(time.minutes).padStart(2, '0') : String(time.minutes),
          })}
          testID='planner-time'
        />
        <Stat
          label={t('stat.newCells')}
          value={t('newCells', { cells: fixed(route.newCellCount, 0) })}
          testID='planner-new-cells'
        />
      </View>
      {route.newCellCount > 0 && (
        <Text style={s.area} testID='planner-new-area'>
          {t('newArea', { area: formatArea(route.newAreaM2 / 1e6) })}
        </Text>
      )}
    </View>
  );
}

function SmallButton({
  testID,
  label,
  a11yLabel,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  a11yLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.small, { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}
    >
      <Text style={s.smallText} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

function LinkButton({
  testID,
  label,
  a11yLabel,
  onPress,
}: {
  testID: string;
  label: string;
  a11yLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole='button'
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      hitSlop={8}
      style={s.link}
    >
      <Text style={s.linkText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK.bg },
  types: { position: 'absolute', top: SPACE.md, left: SPACE.md, flexDirection: 'row', gap: SPACE.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.chip,
    borderWidth: 1.5,
  },
  chipText: { color: DARK.text, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.caption },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACE.lg,
    gap: SPACE.md,
    backgroundColor: DARK.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  statsBlock: { gap: SPACE.xs },
  row: { flexDirection: 'row', gap: SPACE.sm },
  hint: { color: DARK.text, fontSize: FONT_SIZE.lead, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  area: { color: DARK.muted, fontSize: FONT_SIZE.caption },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: DARK.border,
  },
  noteBody: { flex: 1, gap: 2 },
  noteTitle: { color: DARK.text, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.caption },
  noteText: { color: DARK.muted, fontSize: FONT_SIZE.caption },
  error: { color: DARK.text, fontWeight: FONT_WEIGHT.semibold },
  small: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.control,
    borderWidth: 1.5,
    borderColor: DARK.borderControl,
  },
  smallText: { color: DARK.text, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
  record: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    borderRadius: RADIUS.control,
    borderWidth: 2,
  },
  recordOn: { backgroundColor: 'transparent', borderColor: ACCENT },
  recordText: { fontWeight: FONT_WEIGHT.heavy, fontSize: FONT_SIZE.lead },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACE.xs },
  linkText: { color: DARK.accentText, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.caption },
  attribution: { color: DARK.muted, fontSize: FONT_SIZE.label, textAlign: 'center' },
});
